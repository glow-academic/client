"""Document service layer - business logic for document operations."""

from typing import Any, Dict, List, Optional

from app.queries.document_queries import DocumentQueries
from app.schemas.base import (DepartmentMapping, DepartmentMappingItem,
                              ParameterItemMappingItem, ScenarioMappingItem)
from app.schemas.documents import (BulkDeleteDocumentsRequest,
                                   BulkUpdateDocumentsRequest,
                                   DeleteDocumentRequest,
                                   DeleteDocumentResponse,
                                   DocumentDetailBulkRequest,
                                   DocumentDetailBulkResponse,
                                   DocumentDetailRequest,
                                   DocumentDetailResponse, DocumentItem,
                                   DocumentsFilters, DocumentsListResponse,
                                   UpdateDocumentRequest,
                                   UpdateDocumentResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class DocumentService:
    """Service layer for document operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = DocumentQueries()

    def get_documents_list(
        self, filters: DocumentsFilters
    ) -> DocumentsListResponse:
        """Get documents list with tags and scenarios using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_documents(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Build response
        documents = []
        scenario_mapping = {}

        for row in result:
            scenario_ids = [str(sid) for sid in (row.scenario_ids or [])]
            parameter_item_ids = [str(pid) for pid in (row.parameter_item_ids or [])]
            extension = row.extension or ""

            documents.append(
                DocumentItem(
                    document_id=str(row.document_id),
                    name=row.name,
                    type=row.type,
                    updatedAt=row.updated_at.isoformat() if row.updated_at else "",
                    extension=extension,
                    scenario_ids=scenario_ids,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    active=row.active,
                    department_id=str(row.department_id),
                    file_path=row.file_path,
                    mime_type=row.mime_type,
                    parameter_item_ids=parameter_item_ids,
                )
            )

        # Get scenario names for mapping
        if scenario_ids_to_fetch := list(
            set([sid for d in documents for sid in d.scenario_ids])
        ):
            query, params = self.queries.get_scenario_mapping(scenario_ids_to_fetch)
            scenario_result = self.db.execute(text(query), params).fetchall()

            for row in scenario_result:
                scenario_mapping[str(row.id)] = ScenarioMappingItem(
                    name=row.name,
                    description=getattr(row, 'problem_statement', row.name)
                )

        # Build parameter_item_mapping (all items as valid options for now)
        # TODO: Query document_parameter_items junction table for specific items per document
        param_query = text("""
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY(:dept_ids) AND pi.active = true
        """)
        param_results = self.db.execute(
            param_query, {"dept_ids": filters.departmentIds}
        ).fetchall()

        parameter_item_mapping = {
            str(row.id): ParameterItemMappingItem(
                name=row.name,
                description=row.description or ''
            )
            for row in param_results
        }

        return DocumentsListResponse(
            documents=documents,
            scenario_mapping=scenario_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )

    def get_document_detail(
        self, request: DocumentDetailRequest
    ) -> DocumentDetailResponse:
        """Get detailed document information using dynamic SQL."""

        # Get document basic info
        query, params = self.queries.get_document_by_id(request.documentId)
        document = self.db.execute(text(query), params).fetchone()

        if not document:
            raise ValueError(f"Document not found: {request.documentId}")

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        valid_department_ids = [
            str(row.id) for row in self.db.execute(text(query), params).fetchall()
        ]

        # Get all valid parameter items for this department
        # TODO: Query document_parameter_items junction table for specific items
        param_query = text("""
            SELECT pi.id
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = :dept_id AND pi.active = true
        """)
        valid_param_items = [
            str(row.id)
            for row in self.db.execute(
                param_query, {"dept_id": document.department_id}
            ).fetchall()
        ]

        # Get departments with mapping
        departments_query = text("""
        SELECT id, name, description 
        FROM departments 
        WHERE id = ANY(:dept_ids)
        ORDER BY name
        """)
        departments_result = self.db.execute(
            departments_query, {"dept_ids": valid_department_ids}
        ).fetchall()

        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description or ''
            )
            for row in departments_result
        }

        # Build parameter_item_mapping for valid items
        param_mapping_query = text("""
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id = ANY(:param_item_ids)
        """)
        param_mapping_result = self.db.execute(
            param_mapping_query, {"param_item_ids": valid_param_items}
        ).fetchall()

        parameter_item_mapping = {
            str(row.id): ParameterItemMappingItem(
                name=row.name,
                description=row.description
            )
            for row in param_mapping_result
        }

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
            name=document.name,
            active=document.active,
            type=document.type,
            document_type_options=document_type_options,
            department_id=str(document.department_id),
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # TODO: Query document_parameter_items
            valid_parameter_item_ids=valid_param_items,
            parameter_item_mapping=parameter_item_mapping,
        )

    def get_document_detail_bulk(
        self, request: DocumentDetailBulkRequest
    ) -> DocumentDetailBulkResponse:
        """Get bulk document detail information using dynamic SQL."""

        # Get documents basic info
        documents_query = text("""
        SELECT 
            d.id,
            d.type,
            d.department_id
        FROM documents d
        WHERE d.id = ANY(:document_ids)
        """)

        documents_result = self.db.execute(
            documents_query, {"document_ids": request.documentIds}
        ).fetchall()

        if not documents_result:
            raise ValueError("No documents found")

        # Aggregate types (if all same, return that type, else None)
        types = list(set([row.type for row in documents_result]))
        common_type = types[0] if len(types) == 1 else None

        # Aggregate department IDs
        department_ids = list(set([str(row.department_id) for row in documents_result]))

        # Get user's accessible department IDs
        user_dept_query = text("""
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = :profile_id AND d.active = true
        ORDER BY d.name
        """)

        valid_department_ids = [
            str(row.id)
            for row in self.db.execute(
                user_dept_query, {"profile_id": request.profileId}
            ).fetchall()
        ]

        # Get all valid parameter items for these departments
        # TODO: Query document_parameter_items junction table for union of items across docs
        valid_param_query = text("""
            SELECT pi.id
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY(:dept_ids) AND pi.active = true
        """)
        valid_param_items = [
            str(row.id)
            for row in self.db.execute(
                valid_param_query, {"dept_ids": department_ids}
            ).fetchall()
        ]

        # Get departments with mapping
        departments_query = text("""
        SELECT id, name, description 
        FROM departments 
        WHERE id = ANY(:dept_ids)
        ORDER BY name
        """)
        departments_result = self.db.execute(
            departments_query, {"dept_ids": valid_department_ids}
        ).fetchall()

        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description or ''
            )
            for row in departments_result
        }

        # Build parameter_item_mapping for valid items
        param_mapping_query = text("""
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id = ANY(:param_item_ids)
        """)
        param_mapping_result = self.db.execute(
            param_mapping_query, {"param_item_ids": valid_param_items}
        ).fetchall()

        parameter_item_mapping = {
            str(row.id): ParameterItemMappingItem(
                name=row.name,
                description=row.description
            )
            for row in param_mapping_result
        }

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

    def update_document(
        self, request: UpdateDocumentRequest
    ) -> UpdateDocumentResponse:
        """Update a document using dynamic SQL."""

        # Check if document exists
        check_query = text("""
        SELECT name FROM documents WHERE id = :document_id
        """)

        existing = self.db.execute(
            check_query, {"document_id": request.documentId}
        ).fetchone()

        if not existing:
            raise ValueError(f"Document not found: {request.documentId}")

        # Update document
        update_query = text("""
        UPDATE documents SET
            type = :type,
            department_id = :department_id,
            updated_at = NOW()
        WHERE id = :document_id
        """)

        self.db.execute(
            update_query,
            {
                "document_id": request.documentId,
                "type": request.type,
                "department_id": request.department_id,
            },
        )

        # Update tags - delete existing and insert new
        delete_tags_query = text("""
        DELETE FROM simulation_tag_documents WHERE document_id = :document_id
        """)

        self.db.execute(delete_tags_query, {"document_id": request.documentId})

        self.db.commit()

        return UpdateDocumentResponse(
            success=True, message=f"Document '{existing.name}' updated successfully"
        )

    def bulk_update_documents(
        self, request: BulkUpdateDocumentsRequest
    ) -> UpdateDocumentResponse:
        """Bulk update documents using dynamic SQL."""

        # Update all documents
        update_query = text("""
        UPDATE documents SET
            type = :type,
            department_id = :department_id,
            updated_at = NOW()
        WHERE id = ANY(:document_ids)
        """)

        self.db.execute(
            update_query,
            {
                "document_ids": request.documentIds,
                "type": request.type,
                "department_id": request.department_id,
            },
        )

        # Update tags for all documents - delete existing and insert new
        delete_tags_query = text("""
        DELETE FROM simulation_tag_documents WHERE document_id = ANY(:document_ids)
        """)

        self.db.execute(delete_tags_query, {"document_ids": request.documentIds})

        
        self.db.commit()

        return UpdateDocumentResponse(
            success=True,
            message=f"{len(request.documentIds)} documents updated successfully",
        )

    def delete_document(
        self, request: DeleteDocumentRequest
    ) -> DeleteDocumentResponse:
        """Delete a document using dynamic SQL."""

        # Get document name for response
        name_query = text("""
        SELECT name FROM documents WHERE id = :document_id
        """)

        document = self.db.execute(
            name_query, {"document_id": request.documentId}
        ).fetchone()

        if not document:
            raise ValueError(f"Document not found: {request.documentId}")

        # Delete document (cascades will handle junction tables)
        delete_query = text("""
        DELETE FROM documents WHERE id = :document_id
        """)

        self.db.execute(delete_query, {"document_id": request.documentId})
        self.db.commit()

        return DeleteDocumentResponse(
            success=True, message=f"Document '{document.name}' deleted successfully"
        )

    def bulk_delete_documents(
        self, request: BulkDeleteDocumentsRequest
    ) -> DeleteDocumentResponse:
        """Bulk delete documents using dynamic SQL."""

        # Delete all documents
        delete_query = text("""
        DELETE FROM documents WHERE id = ANY(:document_ids)
        """)

        self.db.execute(delete_query, {"document_ids": request.documentIds})
        self.db.commit()

        return DeleteDocumentResponse(
            success=True,
            message=f"{len(request.documentIds)} documents deleted successfully",
        )

