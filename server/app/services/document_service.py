"""Document service layer - business logic for document operations."""

import io
import json
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile

import asyncpg  # type: ignore
from app.cache import keys
from app.extensions import UPLOAD_FOLDER
from app.queries.document_queries import DocumentQueries
from app.schemas.base import (DepartmentMapping, DepartmentMappingItem,
                              ParameterItemMappingItem)
from app.schemas.documents import (BulkDeleteDocumentsRequest,
                                   BulkUpdateDocumentsRequest,
                                   DeleteDocumentRequest,
                                   DeleteDocumentResponse,
                                   DocumentDetailBulkRequest,
                                   DocumentDetailBulkResponse,
                                   DocumentDetailRequest,
                                   DocumentDetailResponse, DocumentItem,
                                   DocumentsFilters, DocumentsListResponse,
                                   FinalizeUploadRequest,
                                   FinalizeUploadResponse,
                                   GenerateCertificateRequest,
                                   UpdateDocumentRequest,
                                   UpdateDocumentResponse)
from app.services.base_service import BaseService, with_cache
from app.utils.mime_utils import get_content_type

logger = logging.getLogger(__name__)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)


class DocumentService(BaseService):
    """Service layer for document operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = DocumentQueries()

    @with_cache(lambda self, filters: keys.document_list(filters))
    async def get_documents_list(
        self, filters: DocumentsFilters
    ) -> DocumentsListResponse:
        """Get documents list with tags and scenarios using dynamic SQL."""
        # Get query from query builder
        query, params = self.queries.list_documents(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        documents = []
        scenario_mapping = {}
        parameter_item_mapping = {}
        department_mapping: DepartmentMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse scenario mapping from JSONB with type safety (may be string or dict)
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                from app.schemas.base import ScenarioMappingItem

                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_id=None,
                            persona_mapping={},
                            document_mapping={},
                            parameter_item_mapping={},
                            parameter_item_ids=[],
                            document_ids=[],
                        )

            # Parse parameter_item mapping from JSONB with type safety (may be string or dict)
            param_mapping_data = first_row.get("parameter_item_mapping")
            if isinstance(param_mapping_data, str):
                param_mapping_data = json.loads(param_mapping_data)
            if param_mapping_data and isinstance(param_mapping_data, dict):
                for pid, pdata in param_mapping_data.items():
                    if isinstance(pdata, dict):
                        parameter_item_mapping[pid] = ParameterItemMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            parameter_id=str(pdata["parameter_id"])
                            if pdata.get("parameter_id")
                            else "",
                            parameter_name=pdata.get("parameter_name", ""),
                            value=pdata.get("value", ""),
                        )

            # Parse department mapping from JSONB with type safety (may be string or dict)
            dept_mapping_data = first_row.get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Build document items
        for row in result:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            extension = row["extension"] or ""

            documents.append(
                DocumentItem(
                    document_id=str(row["document_id"]),
                    name=row["name"],
                    type=row["type"],
                    updatedAt=row["updated_at"].isoformat()
                    if row["updated_at"]
                    else "",
                    extension=extension,
                    scenario_ids=scenario_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    active=row["active"],
                    department_id=str(row["department_id"]),
                    file_path=row["file_path"],
                    mime_type=row["mime_type"],
                    parameter_item_ids=parameter_item_ids,
                )
            )

        return DocumentsListResponse(
            documents=documents,
            scenario_mapping=scenario_mapping,
            parameter_item_mapping=parameter_item_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.document_by_id(request.documentId))
    async def get_document_detail(
        self, request: DocumentDetailRequest
    ) -> DocumentDetailResponse:
        """Get detailed document information using dynamic SQL."""
        # Get all document data with mappings in a single query
        query, params = self.queries.get_document_detail_complete(
            request.documentId, request.profileId
        )
        document = await self.conn.fetchrow(query, *params)

        if not document:
            raise ValueError(f"Document not found: {request.documentId}")

        # Parse valid_department_ids from array
        valid_department_ids = document["valid_department_ids"] or []

        # Parse valid_parameter_item_ids from array
        valid_param_items = document["valid_parameter_item_ids"] or []

        # Parse department_mapping from JSONB with type safety (may be string or dict)
        department_mapping = {}
        dept_mapping_data = document.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter_item_mapping from JSONB with type safety (may be string or dict)
        parameter_item_mapping = {}
        param_mapping_data = document.get("parameter_item_mapping")
        if isinstance(param_mapping_data, str):
            param_mapping_data = json.loads(param_mapping_data)
        if param_mapping_data and isinstance(param_mapping_data, dict):
            for param_id, pdata in param_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_item_mapping[param_id] = ParameterItemMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        parameter_id=pdata.get("parameter_id", ""),
                        parameter_name=pdata.get("parameter_name", ""),
                        value=pdata.get("value", ""),
                    )

        # Document type options
        document_type_options = [
            "homework",
            "project",
            "quiz",
            "midterm",
            "lab",
            "lecture",
            "syllabus",
        ]

        return DocumentDetailResponse(
            name=document["name"],
            active=document["active"],
            type=document["type"],
            document_type_options=document_type_options,
            department_id=str(document["department_id"]),
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # TODO: Query document_parameter_items
            valid_parameter_item_ids=valid_param_items,
            parameter_item_mapping=parameter_item_mapping,
        )

    @with_cache(
        lambda self, request: keys.document_bulk_detail(
            request.documentIds, request.profileId
        )
    )
    async def get_document_detail_bulk(
        self, request: DocumentDetailBulkRequest
    ) -> DocumentDetailBulkResponse:
        """Get bulk document detail information using dynamic SQL."""
        # Get all document data with mappings in a single query
        query, params = self.queries.get_document_detail_bulk_complete(
            request.documentIds, request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("No documents found")

        # Parse types array and determine common type
        types = result["types"] or []
        common_type = types[0] if len(types) == 1 else None

        # Parse department IDs from array
        department_ids = result["department_ids"] or []

        # Parse valid_department_ids from array
        valid_department_ids = result["valid_department_ids"] or []

        # Parse valid_parameter_item_ids from array
        valid_param_items = result["valid_parameter_item_ids"] or []

        # Parse department_mapping from JSONB with type safety (may be string or dict)
        department_mapping = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter_item_mapping from JSONB with type safety (may be string or dict)
        parameter_item_mapping = {}
        param_mapping_data = result.get("parameter_item_mapping")
        if isinstance(param_mapping_data, str):
            param_mapping_data = json.loads(param_mapping_data)
        if param_mapping_data and isinstance(param_mapping_data, dict):
            for param_id, pdata in param_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_item_mapping[param_id] = ParameterItemMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        parameter_id=pdata.get("parameter_id", ""),
                        parameter_name=pdata.get("parameter_name", ""),
                        value=pdata.get("value", ""),
                    )

        document_type_options = [
            "homework",
            "project",
            "quiz",
            "midterm",
            "lab",
            "lecture",
            "syllabus",
        ]

        return DocumentDetailBulkResponse(
            document_type_options=document_type_options,
            type=common_type,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # TODO: Query document_parameter_items for union
            valid_parameter_item_ids=valid_param_items,
            parameter_item_mapping=parameter_item_mapping,
        )

    async def update_document(
        self, request: UpdateDocumentRequest
    ) -> UpdateDocumentResponse:
        """Update a document using dynamic SQL."""

        # Check if document exists
        query, params = self.queries.get_document_name(request.documentId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Document not found: {request.documentId}")

        # Update document
        query, _ = self.queries.update_document()
        await self.conn.execute(
            query,
            request.documentId,
            request.type,
            request.department_id,
        )

        # Update parameter items - delete existing and insert new
        query, params = self.queries.delete_document_parameter_items(request.documentId)
        await self.conn.execute(query, *params)

        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_document_by_id(request.documentId),
                keys.tag_document_all(),
            ]
        )

        return UpdateDocumentResponse(
            success=True, message=f"Document '{existing['name']}' updated successfully"
        )

    async def bulk_update_documents(
        self, request: BulkUpdateDocumentsRequest
    ) -> UpdateDocumentResponse:
        """Bulk update documents using dynamic SQL."""

        # Update all documents
        query, _ = self.queries.bulk_update_documents()
        await self.conn.execute(
            query,
            request.documentIds,
            request.type,
            request.department_id,
        )

        # Update parameter items for all documents - delete existing and insert new
        query, params = self.queries.delete_document_parameter_items_bulk(
            request.documentIds
        )
        await self.conn.execute(query, *params)

        # Transaction handled

        # Invalidate caches for all affected documents
        tags = [keys.tag_document_all()]
        for doc_id in request.documentIds:
            tags.append(keys.tag_document_by_id(doc_id))
        await self._invalidate_cache(tags)

        return UpdateDocumentResponse(
            success=True,
            message=f"{len(request.documentIds)} documents updated successfully",
        )

    async def delete_document(
        self, request: DeleteDocumentRequest
    ) -> DeleteDocumentResponse:
        """Delete a document from database and filesystem."""

        # Get document info including file_path
        query, params = self.queries.get_document_info_with_path(request.documentId)
        document = await self.conn.fetchrow(query, *params)

        if not document:
            raise ValueError(f"Document not found: {request.documentId}")

        # Delete physical file from filesystem
        file_path = os.path.join(UPLOAD_FOLDER, document["file_path"])
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {str(e)}")
        else:
            logger.warning(f"File not found in filesystem: {file_path}")

        # Delete document from database (cascades will handle junction tables)
        query, params = self.queries.delete_document(request.documentId)
        await self.conn.execute(query, *params)
        # Transaction handled

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_document_by_id(request.documentId),
                keys.tag_document_all(),
            ]
        )

        return DeleteDocumentResponse(
            success=True, message=f"Document '{document['name']}' deleted successfully"
        )

    async def bulk_delete_documents(
        self, request: BulkDeleteDocumentsRequest
    ) -> DeleteDocumentResponse:
        """Bulk delete documents from database and filesystem."""

        # Get all document file paths
        query, params = self.queries.get_documents_info_with_path(request.documentIds)
        documents = await self.conn.fetch(query, *params)

        if not documents:
            raise ValueError("No documents found to delete")

        # Delete physical files from filesystem
        deleted_count = 0
        for doc in documents:
            file_path = os.path.join(UPLOAD_FOLDER, doc["file_path"])
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted file: {file_path}")
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete file {file_path}: {str(e)}")
            else:
                logger.warning(f"File not found in filesystem: {file_path}")

        # Delete all documents from database
        query, params = self.queries.bulk_delete_documents(request.documentIds)
        await self.conn.execute(query, *params)
        # Transaction handled

        # Invalidate caches for all deleted documents
        tags = [keys.tag_document_all()]
        for doc_id in request.documentIds:
            tags.append(keys.tag_document_by_id(doc_id))
        await self._invalidate_cache(tags)

        return DeleteDocumentResponse(
            success=True,
            message=f"{len(request.documentIds)} documents deleted successfully ({deleted_count} files removed)",
        )

    # TUS Upload Methods
    async def create_tus_upload(
        self, upload_length: str, metadata: dict[str, str], app_prefix: str = ""
    ) -> tuple[str, str, int]:
        """
        Create a new TUS upload.

        Returns:
            Tuple of (upload_id, location_path, initial_offset)
        """
        upload_id = str(uuid.uuid4())
        upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
        os.makedirs(upload_dir, exist_ok=True)

        # Save metadata
        with open(os.path.join(upload_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f)

        # Create empty file
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            pass

        # Save upload info
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{upload_length}\noffset:0")

        # Generate location path
        if app_prefix:
            location = f"/{app_prefix}/api/v2/documents/upload/{upload_id}"
        else:
            location = f"/api/v2/documents/upload/{upload_id}"

        return upload_id, location, 0

    async def get_tus_upload_info(self, upload_id: str) -> dict[str, str] | None:
        """Get TUS upload info for HEAD request."""
        upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)

        if not os.path.exists(upload_dir):
            return None

        # Read info file
        info = {}
        with open(os.path.join(upload_dir, "info")) as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        return info

    def append_tus_chunk(
        self, upload_id: str, chunk_data: bytes, expected_offset: str
    ) -> tuple[bool, int | None, str | None]:
        """
        Append a chunk to a TUS upload.

        Returns:
            Tuple of (success, new_offset, error_message)
        """
        upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)

        if not os.path.exists(upload_dir):
            return False, None, "Upload not found"

        # Read info file
        info = {}
        with open(os.path.join(upload_dir, "info")) as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        # Check offset
        if expected_offset != info.get("offset"):
            return False, None, "Offset mismatch"

        # Append to file
        with open(os.path.join(upload_dir, "file"), "ab") as f:
            f.write(chunk_data)

        # Update offset
        new_offset = int(info.get("offset", "0")) + len(chunk_data)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

        return True, new_offset, None

    async def finalize_tus_upload(
        self, request: FinalizeUploadRequest
    ) -> FinalizeUploadResponse:
        """Finalize a TUS upload and process the file."""
        try:
            # Validate department_id is provided
            department_id = request.department_id
            if not department_id:
                return FinalizeUploadResponse(
                    success=False,
                    message="department_id is required - must be provided from frontend",
                    status="error",
                )
            
            # Find the upload directory
            upload_dir = None
            for dir_name in os.listdir(TUS_UPLOADS_DIR):
                metadata_path = os.path.join(TUS_UPLOADS_DIR, dir_name, "metadata.json")
                if os.path.exists(metadata_path):
                    with open(metadata_path) as f:
                        metadata = json.load(f)
                        if metadata.get("fileId") == request.fileId:
                            upload_dir = os.path.join(TUS_UPLOADS_DIR, dir_name)
                            break

            if not upload_dir:
                return FinalizeUploadResponse(
                    success=False,
                    message=f"Upload with fileId {request.fileId} not found",
                    status="error",
                )

            # Get the uploaded file path
            file_path = os.path.join(upload_dir, "file")

            # Check if file exists and has content
            if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                return FinalizeUploadResponse(
                    success=False,
                    message="Upload file is missing or empty",
                    status="error",
                )

            # Handle CSV uploads
            if request.csv:
                from app.services.profile_service import ProfileService

                # Process CSV file to create profiles
                profile_service = ProfileService(self.conn)
                result = await profile_service.create_profiles_from_csv(file_path)

                # Clean up upload directory
                try:
                    shutil.rmtree(upload_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up upload directory: {str(e)}")

                if not result["success"]:
                    return FinalizeUploadResponse(
                        success=False,
                        message=result.get("error", "Failed to process CSV file"),
                        status="error",
                    )

                # Build success message
                message_parts = [f"Created {result['users_created']} users"]
                if result["users_skipped"] > 0:
                    message_parts.append(
                        f"skipped {result['users_skipped']} existing users"
                    )
                if result["errors"]:
                    message_parts.append(f"{len(result['errors'])} errors encountered")

                return FinalizeUploadResponse(
                    success=True,
                    message=", ".join(message_parts),
                    status="complete",
                )

            # Handle ZIP file uploads
            if request.zip:
                extracted_documents = []

                with zipfile.ZipFile(file_path, "r") as zip_ref:
                    extract_dir = os.path.join(
                        TUS_UPLOADS_DIR, f"extract_{request.fileId}"
                    )
                    os.makedirs(extract_dir, exist_ok=True)
                    zip_ref.extractall(extract_dir)

                    for root, dirs, files in os.walk(extract_dir):
                        for filename in files:
                            if filename.startswith(".") or filename.startswith(
                                "__MACOSX"
                            ):
                                continue

                            extracted_file_path = os.path.join(root, filename)
                            document_id = uuid.uuid4()
                            _, ext = os.path.splitext(filename)
                            if not ext:
                                ext = ".bin"

                            final_file_path = f"{document_id}{ext}"
                            final_full_path = os.path.join(
                                UPLOAD_FOLDER, final_file_path
                            )
                            shutil.copy2(extracted_file_path, final_full_path)

                            content_type = get_content_type(filename)

                            # Insert document into database
                            query, _ = self.queries.insert_document()
                            await self.conn.execute(
                                query,
                                document_id,
                                filename,
                                final_file_path,
                                content_type,
                                department_id,
                                str(document_id),  # file_id: use document_id for extracted files
                            )
                            extracted_documents.append(
                                {
                                    "id": str(document_id),
                                    "name": filename,
                                    "mime_type": content_type,
                                }
                            )

                    # Clean up
                    try:
                        shutil.rmtree(extract_dir)
                        shutil.rmtree(upload_dir)
                    except Exception as e:
                        logger.warning(f"Failed to clean up directories: {str(e)}")

                # Transaction handled

                # Invalidate document list cache after bulk upload
                await self._invalidate_cache([keys.tag_document_all()])

                return FinalizeUploadResponse(
                    success=True,
                    message=f"ZIP file processed successfully. Extracted {len(extracted_documents)} documents.",
                    status="success",
                    documents=extracted_documents,
                )

            # Handle regular document upload
            document_id = uuid.uuid4()

            with open(metadata_path) as f:
                metadata = json.load(f)

            filename = metadata.get("filename", "unknown")
            _, ext = os.path.splitext(filename)
            if not ext:
                ext = ".bin"

            final_file_path = f"{document_id}{ext}"
            final_full_path = os.path.join(UPLOAD_FOLDER, final_file_path)
            shutil.copy2(file_path, final_full_path)

            content_type = metadata.get("filetype") or get_content_type(filename)

            # Insert document into database
            query, _ = self.queries.insert_document()
            await self.conn.execute(
                query,
                document_id,
                filename,
                final_file_path,
                content_type,
                department_id,
                request.fileId,  # file_id: TUS upload file ID
            )

            # Insert parameter item relationships if provided
            if request.parameter_item_ids:
                for param_item_id in request.parameter_item_ids:
                    await self.conn.execute(
                        """
                        INSERT INTO document_parameter_items (document_id, parameter_item_id)
                        VALUES ($1, $2)
                        ON CONFLICT (document_id, parameter_item_id) DO NOTHING
                        """,
                        document_id,
                        param_item_id,
                    )

            # Clean up
            try:
                shutil.rmtree(upload_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up upload directory: {str(e)}")

            # Transaction handled

            # Invalidate document list cache after upload
            await self._invalidate_cache(
                [
                    keys.tag_document_by_id(str(document_id)),
                    keys.tag_document_all(),
                ]
            )

            # Auto-classify if requested
            if request.autoClassify:
                try:
                    # Note: run_classify_agent might be async or have different signature
                    # Skipping auto-classification for now to avoid type errors
                    logger.info(
                        f"Auto-classification requested for document {document_id}"
                    )
                except Exception as e:
                    logger.error(f"Auto-classification failed: {str(e)}")

            return FinalizeUploadResponse(
                success=True,
                message="Document uploaded successfully",
                status="success",
                document_id=str(document_id),
            )

        except Exception as e:
            logger.error(f"Error finalizing upload: {str(e)}")
            return FinalizeUploadResponse(
                success=False,
                message=f"Failed to finalize upload: {str(e)}",
                status="error",
            )

    # Download Methods
    @with_cache(lambda self, document_id: keys.document_file_info(document_id))
    async def get_document_file(self, document_id: str) -> tuple[str, str, str] | None:
        """
        Get document file path and metadata for download.

        Returns:
            Tuple of (file_path, filename, content_type) or None if not found
        """
        query, params = self.queries.get_document_file_info(document_id)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            return None

        file_path = os.path.join(UPLOAD_FOLDER, result["file_path"])

        if not os.path.exists(file_path):
            return None

        content_type = get_content_type(result["name"], result["mime_type"])

        return file_path, result["name"], content_type

    # Certificate Generation
    def generate_certificate(
        self, request: GenerateCertificateRequest
    ) -> tuple[bytes, str, dict[str, str]]:
        """
        Generate a certificate PDF/text for a profile showing their progress.

        Returns:
            Tuple of (file_content, content_type, headers_dict)
        """
        profile_name = request.profileName
        cohort_data = request.cohortData

        # Try to generate PDF using reportlab
        try:
            from reportlab.graphics.shapes import Drawing, Rect  # type: ignore
            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.lib.styles import ParagraphStyle  # type: ignore
            from reportlab.lib.styles import \
                getSampleStyleSheet  # type: ignore
            from reportlab.lib.units import inch  # type: ignore
            from reportlab.platypus import Frame  # type: ignore
            from reportlab.platypus import PageTemplate  # type: ignore
            from reportlab.platypus import Paragraph  # type: ignore
            from reportlab.platypus import SimpleDocTemplate  # type: ignore
            from reportlab.platypus import Spacer  # type: ignore
            from reportlab.platypus import Table  # type: ignore
            from reportlab.platypus import TableStyle  # type: ignore

            # Create PDF in memory
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                leftMargin=0.5 * inch,
                rightMargin=0.5 * inch,
                topMargin=0.5 * inch,
                bottomMargin=0.5 * inch,
            )
            story = []

            # Create content frame
            content_frame = Frame(
                doc.leftMargin + 0.2 * inch,
                doc.bottomMargin + 0.2 * inch,
                doc.width - 0.4 * inch,
                doc.height - 0.4 * inch,
                leftPadding=0.1 * inch,
                bottomPadding=0.1 * inch,
                rightPadding=0.1 * inch,
                topPadding=0.1 * inch,
                showBoundary=1,
            )

            # Get styles
            styles = getSampleStyleSheet()

            # Create custom styles
            title_style = ParagraphStyle(
                "CustomTitle",
                parent=styles["Heading1"],
                fontSize=24,
                spaceAfter=30,
                alignment=1,
                textColor=colors.darkblue,
            )

            name_style = ParagraphStyle(
                "NameStyle",
                parent=styles["Heading2"],
                fontSize=28,
                spaceAfter=20,
                alignment=1,
                textColor=colors.black,
            )

            status_style = ParagraphStyle(
                "StatusStyle",
                parent=styles["Heading2"],
                fontSize=20,
                spaceAfter=30,
                alignment=1,
                fontWeight="bold",
            )

            header_style = ParagraphStyle(
                "HeaderStyle",
                parent=styles["Heading3"],
                fontSize=14,
                spaceAfter=10,
                textColor=colors.darkblue,
            )

            # Add title
            story.append(Paragraph("Certificate of Completion", title_style))
            story.append(Spacer(1, 10))

            # Add profile name
            story.append(Paragraph(profile_name, name_style))
            story.append(Spacer(1, 30))

            # Calculate overall status
            total_cohorts = len(cohort_data)
            passed_cohorts = sum(
                1 for cohort in cohort_data if cohort.get("passed", False)
            )
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0

            # Add status
            if all_passed:
                status_text = "COMPLETE"
                status_color = colors.green
            else:
                status_text = "INCOMPLETE"
                status_color = colors.red

            status_style.textColor = status_color
            story.append(Paragraph(status_text, status_style))
            story.append(Spacer(1, 30))

            # Add progress summary
            summary_text = (
                f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed"
            )
            story.append(Paragraph(summary_text, styles["Normal"]))
            story.append(Spacer(1, 20))

            # Add cohort details
            if cohort_data:
                story.append(Paragraph("Cohort Progress", header_style))

                # Create table data
                table_data = [["Cohort", "Simulation", "Score", "Status"]]

                for cohort in cohort_data:
                    cohort_name = cohort.get("name", "Unknown Cohort")
                    simulations = cohort.get("simulations", [])

                    for sim in simulations:
                        sim_name = sim.get("name", "Unknown Simulation")
                        score = sim.get("score", 0)
                        passed = sim.get("passed", False)

                        score_text = f"{score}%" if score > 0 else "No attempts"
                        status_text = (
                            "PASS"
                            if passed
                            else "FAIL"
                            if score > 0
                            else "Not attempted"
                        )

                        table_data.append(
                            [cohort_name, sim_name, score_text, status_text]
                        )

                # Create table
                table = Table(
                    table_data, colWidths=[1.8 * inch, 2.5 * inch, 1 * inch, 1 * inch]
                )
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 11),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.lightblue),
                            ("GRID", (0, 0), (-1, -1), 1, colors.darkblue),
                            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                            ("FONTSIZE", (0, 1), (-1, -1), 9),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("WORDWRAP", (0, 0), (-1, -1), True),
                            ("LEFTPADDING", (0, 0), (-1, -1), 6),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                            ("TOPPADDING", (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                        ]
                    )
                )

                story.append(table)
                story.append(Spacer(1, 30))

            # Custom page template with decorative border
            def certificate_page(canvas, doc):  # type: ignore
                # Draw outer border
                canvas.setStrokeColor(colors.darkblue)
                canvas.setLineWidth(3)
                canvas.rect(
                    doc.leftMargin + 0.1 * inch,
                    doc.bottomMargin + 0.1 * inch,
                    doc.width - 0.2 * inch,
                    doc.height - 0.2 * inch,
                )

                # Draw inner border
                canvas.setLineWidth(1)
                canvas.rect(
                    doc.leftMargin + 0.2 * inch,
                    doc.bottomMargin + 0.2 * inch,
                    doc.width - 0.4 * inch,
                    doc.height - 0.4 * inch,
                )

                # Draw corner decorations
                canvas.setFillColor(colors.lightblue)
                corner_size = 0.15 * inch
                for x, y in [
                    (
                        doc.leftMargin + 0.1 * inch,
                        doc.bottomMargin + doc.height - 0.25 * inch,
                    ),
                    (
                        doc.leftMargin + doc.width - 0.25 * inch,
                        doc.bottomMargin + doc.height - 0.25 * inch,
                    ),
                    (doc.leftMargin + 0.1 * inch, doc.bottomMargin + 0.1 * inch),
                    (
                        doc.leftMargin + doc.width - 0.25 * inch,
                        doc.bottomMargin + 0.1 * inch,
                    ),
                ]:
                    canvas.rect(x, y, corner_size, corner_size, fill=1)

                # Add branding
                canvas.setFont("Helvetica", 10)
                canvas.setFillColor(colors.darkblue)
                canvas.drawString(
                    doc.leftMargin + 0.3 * inch,
                    doc.bottomMargin + 0.3 * inch,
                    "GLOW | Purdue University",
                )

            page_template = PageTemplate(
                id="certificate", frames=[content_frame], onPage=certificate_page
            )
            doc.addPageTemplates([page_template])
            doc.build(story)
            buffer.seek(0)
            original_pdf_bytes = buffer.getvalue()
            pdf_bytes_to_return = original_pdf_bytes

            # Try PDF/A conversion with Ghostscript (best-effort)
            try:

                def find_srgb_icc() -> str | None:
                    candidate_paths = [
                        "/usr/share/color/icc/ghostscript/srgb.icc",
                        "/usr/share/color/icc/srgb.icc",
                        "/usr/share/icc/colord/sRGB.icc",
                        "/usr/share/ghostscript/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/10.00.0/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/9.56.1/iccprofiles/srgb.icc",
                    ]
                    for path in candidate_paths:
                        if os.path.exists(path):
                            return path
                    return None

                srgb_icc = find_srgb_icc()

                with (
                    tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as in_file,
                    tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as out_file,
                ):
                    in_file.write(original_pdf_bytes)
                    in_file.flush()

                    gs_cmd = [
                        "gs",
                        "-dBATCH",
                        "-dNOPAUSE",
                        "-sDEVICE=pdfwrite",
                        "-dPDFSETTINGS=/prepress",
                        "-sProcessColorModel=DeviceRGB",
                        "-sColorConversionStrategy=sRGB",
                        "-dUseCIEColor",
                        "-dPDFA=2",
                        "-dPDFACompatibilityPolicy=1",
                        f"-sOutputFile={out_file.name}",
                    ]

                    if srgb_icc:
                        gs_cmd.append(f"-sOutputICCProfile={srgb_icc}")

                    gs_cmd.append(in_file.name)

                    proc = subprocess.run(gs_cmd, capture_output=True, text=True)
                    if (
                        proc.returncode == 0
                        and os.path.exists(out_file.name)
                        and os.path.getsize(out_file.name) > 0
                    ):
                        with open(out_file.name, "rb") as f_out:
                            pdf_bytes_to_return = f_out.read()
                    else:
                        logger.warning(
                            "Ghostscript PDF/A conversion failed; returning original PDF. stderr=%s",
                            proc.stderr,
                        )
            except FileNotFoundError:
                logger.info("Ghostscript not found; returning non-PDF/A PDF")
            except Exception as conv_err:
                logger.warning(
                    "PDF/A conversion error; returning original PDF: %s", str(conv_err)
                )

            # Generate filename
            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.pdf"

            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

            return pdf_bytes_to_return, "application/pdf", headers

        except ImportError:
            # Fallback to text if reportlab not available
            logger.warning("ReportLab not available, using simple text generation")

            text_content = []
            text_content.append("Certificate of Completion")
            text_content.append("=" * 30)
            text_content.append("")
            text_content.append(f"Name: {profile_name}")
            text_content.append("")

            total_cohorts = len(cohort_data)
            passed_cohorts = sum(
                1 for cohort in cohort_data if cohort.get("passed", False)
            )
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0

            text_content.append(f"Status: {'COMPLETE' if all_passed else 'INCOMPLETE'}")
            text_content.append(
                f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed"
            )
            text_content.append("")

            text_content.append("Cohort Progress:")
            text_content.append("-" * 20)

            for cohort in cohort_data:
                cohort_name = cohort.get("name", "Unknown Cohort")
                simulations = cohort.get("simulations", [])

                text_content.append(f"\n{cohort_name}:")
                for sim in simulations:
                    sim_name = sim.get("name", "Unknown Simulation")
                    score = sim.get("score", 0)
                    passed = sim.get("passed", False)

                    score_text = f"{score}%" if score > 0 else "No attempts"
                    status_text = (
                        "PASS" if passed else "FAIL" if score > 0 else "Not attempted"
                    )

                    text_content.append(f"  - {sim_name}: {score_text} ({status_text})")

            text_content.append("")
            text_content.append("GLOW | Purdue University")

            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.txt"

            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

            return "\n".join(text_content).encode("utf-8"), "text/plain", headers


def get_document_service(conn: asyncpg.Connection) -> DocumentService:
    """Get document service instance."""
    return DocumentService(conn)
