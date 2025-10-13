"""Document service layer - business logic for document operations."""

from typing import Any, Dict, List, Optional

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
from app.schemas.personas import DepartmentMappingItem
from sqlalchemy import text
from sqlalchemy.orm import Session


class DocumentService:
    """Service layer for document operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db

    def get_documents_list(
        self, filters: DocumentsFilters
    ) -> DocumentsListResponse:
        """Get documents list with tags and scenarios using dynamic SQL."""

        query = text("""
        WITH document_tags AS (
            SELECT 
                std.document_id,
                ARRAY_AGG(DISTINCT (std.simulation_id || '_' || std.tag_idx::text)) as tag_ids
            FROM simulation_tag_documents std
            WHERE std.active = true
            GROUP BY std.document_id
        ),
        document_scenarios AS (
            SELECT 
                sd.document_id,
                ARRAY_AGG(DISTINCT sd.scenario_id) as scenario_ids
            FROM scenario_documents sd
            WHERE sd.active = true
            GROUP BY sd.document_id
        ),
        document_data AS (
            SELECT 
                d.id as document_id,
                d.name,
                d.type,
                d.updated_at,
                d.mime_type,
                COALESCE(dt.tag_ids, ARRAY[]::text[]) as tag_ids,
                COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids
            FROM documents d
            LEFT JOIN document_tags dt ON dt.document_id = d.id
            LEFT JOIN document_scenarios ds ON ds.document_id = d.id
            WHERE d.department_id = ANY(:department_ids)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            dd.*,
            SUBSTRING(dd.mime_type FROM '\\.([^\\.]+)$') as extension,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_delete
        FROM document_data dd
        CROSS JOIN user_profile up
        ORDER BY dd.updated_at DESC
        """)

        params = {
            "department_ids": filters.departmentIds,
            "profile_id": filters.profileId,
        }

        result = self.db.execute(query, params).fetchall()

        # Build response
        documents = []
        tag_mapping = {}
        scenario_mapping = {}

        for row in result:
            tag_ids = row.tag_ids or []
            scenario_ids = [str(sid) for sid in (row.scenario_ids or [])]
            extension = row.extension or ""

            documents.append(
                DocumentItem(
                    document_id=str(row.document_id),
                    name=row.name,
                    type=row.type,
                    updatedAt=row.updated_at.isoformat() if row.updated_at else "",
                    tag_ids=tag_ids,
                    extension=extension,
                    scenario_ids=scenario_ids,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                )
            )

        # Get tag names for mapping
        if tag_ids_to_fetch := list(
            set([tid for d in documents for tid in d.tag_ids])
        ):
            # Parse simulation_id and tag_idx from composite tag_id
            tag_parts = [tid.split("_") for tid in tag_ids_to_fetch]
            sim_tag_pairs = [(parts[0], int(parts[1])) for parts in tag_parts if len(parts) == 2]
            
            if sim_tag_pairs:
                # Query simulation_tags for names
                tag_query = text("""
                SELECT 
                    simulation_id,
                    idx,
                    name,
                    (simulation_id::text || '_' || idx::text) as tag_id
                FROM simulation_tags
                WHERE (simulation_id, idx) IN (
                    SELECT unnest(:sim_ids::uuid[]), unnest(:tag_idxs::integer[])
                )
                """)
                
                sim_ids = [pair[0] for pair in sim_tag_pairs]
                tag_idxs = [pair[1] for pair in sim_tag_pairs]
                
                tag_result = self.db.execute(
                    tag_query, {"sim_ids": sim_ids, "tag_idxs": tag_idxs}
                ).fetchall()

                for row in tag_result:
                    tag_mapping[row.tag_id] = row.name

        # Get scenario names for mapping
        if scenario_ids_to_fetch := list(
            set([sid for d in documents for sid in d.scenario_ids])
        ):
            scenario_query = text("""
            SELECT id, name 
            FROM scenarios 
            WHERE id = ANY(:scenario_ids)
            """)
            scenario_result = self.db.execute(
                scenario_query, {"scenario_ids": scenario_ids_to_fetch}
            ).fetchall()

            for row in scenario_result:
                scenario_mapping[str(row.id)] = row.name

        return DocumentsListResponse(
            documents=documents,
            tag_mapping=tag_mapping,
            scenario_mapping=scenario_mapping,
        )

    def get_document_detail(
        self, request: DocumentDetailRequest
    ) -> DocumentDetailResponse:
        """Get detailed document information using dynamic SQL."""

        # Get document basic info
        document_query = text("""
        SELECT 
            d.name,
            d.active,
            d.type,
            d.department_id
        FROM documents d
        WHERE d.id = :document_id
        """)

        document = self.db.execute(
            document_query, {"document_id": request.documentId}
        ).fetchone()

        if not document:
            raise ValueError(f"Document not found: {request.documentId}")

        # Get tag IDs for this document
        tag_query = text("""
        SELECT 
            (simulation_id::text || '_' || tag_idx::text) as tag_id
        FROM simulation_tag_documents
        WHERE document_id = :document_id AND active = true
        """)

        tag_result = self.db.execute(
            tag_query, {"document_id": request.documentId}
        ).fetchall()

        tag_ids = [row.tag_id for row in tag_result]

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

        # Get valid tag IDs (all active tags in user's departments)
        valid_tags_query = text("""
        SELECT DISTINCT
            (st.simulation_id::text || '_' || st.idx::text) as tag_id
        FROM simulation_tags st
        JOIN simulations s ON s.id = st.simulation_id
        WHERE s.department_id = ANY(:dept_ids) AND s.active = true
        """)

        valid_tag_ids = [
            row.tag_id
            for row in self.db.execute(
                valid_tags_query, {"dept_ids": valid_department_ids}
            ).fetchall()
        ]

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
            tag_ids=tag_ids,
            valid_tag_ids=valid_tag_ids,
            department_id=str(document.department_id),
            valid_department_ids=valid_department_ids,
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

        # Get tag IDs for these documents
        tag_query = text("""
        SELECT DISTINCT
            (simulation_id::text || '_' || tag_idx::text) as tag_id
        FROM simulation_tag_documents
        WHERE document_id = ANY(:document_ids) AND active = true
        """)

        tag_result = self.db.execute(
            tag_query, {"document_ids": request.documentIds}
        ).fetchall()

        tag_ids = [row.tag_id for row in tag_result]

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

        # Get valid tag IDs
        valid_tags_query = text("""
        SELECT DISTINCT
            (st.simulation_id::text || '_' || st.idx::text) as tag_id
        FROM simulation_tags st
        JOIN simulations s ON s.id = st.simulation_id
        WHERE s.department_id = ANY(:dept_ids) AND s.active = true
        """)

        valid_tag_ids = [
            row.tag_id
            for row in self.db.execute(
                valid_tags_query, {"dept_ids": valid_department_ids}
            ).fetchall()
        ]

        # Get tag names for mapping
        tag_mapping = {}
        if tag_ids:
            tag_parts = [tid.split("_") for tid in tag_ids]
            sim_tag_pairs = [(parts[0], int(parts[1])) for parts in tag_parts if len(parts) == 2]
            
            if sim_tag_pairs:
                tag_name_query = text("""
                SELECT 
                    simulation_id,
                    idx,
                    name,
                    (simulation_id::text || '_' || idx::text) as tag_id
                FROM simulation_tags
                WHERE (simulation_id, idx) IN (
                    SELECT unnest(:sim_ids::uuid[]), unnest(:tag_idxs::integer[])
                )
                """)
                
                sim_ids = [pair[0] for pair in sim_tag_pairs]
                tag_idxs = [pair[1] for pair in sim_tag_pairs]
                
                tag_name_result = self.db.execute(
                    tag_name_query, {"sim_ids": sim_ids, "tag_idxs": tag_idxs}
                ).fetchall()

                for row in tag_name_result:
                    tag_mapping[row.tag_id] = row.name

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
                name=row.name, description=row.description
            )
            for row in departments_result
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
            tag_ids=tag_ids,
            valid_tag_ids=valid_tag_ids,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            tag_mapping=tag_mapping,
            department_mapping=department_mapping,
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

        # Insert new tags
        if request.tag_ids:
            for tag_id in request.tag_ids:
                parts = tag_id.split("_")
                if len(parts) == 2:
                    insert_tag_query = text("""
                    INSERT INTO simulation_tag_documents (
                        simulation_id,
                        tag_idx,
                        document_id,
                        active
                    )
                    VALUES (
                        :simulation_id,
                        :tag_idx,
                        :document_id,
                        true
                    )
                    ON CONFLICT DO NOTHING
                    """)

                    self.db.execute(
                        insert_tag_query,
                        {
                            "simulation_id": parts[0],
                            "tag_idx": int(parts[1]),
                            "document_id": request.documentId,
                        },
                    )

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

        # Insert new tags for all documents
        if request.tag_ids:
            for document_id in request.documentIds:
                for tag_id in request.tag_ids:
                    parts = tag_id.split("_")
                    if len(parts) == 2:
                        insert_tag_query = text("""
                        INSERT INTO simulation_tag_documents (
                            simulation_id,
                            tag_idx,
                            document_id,
                            active
                        )
                        VALUES (
                            :simulation_id,
                            :tag_idx,
                            :document_id,
                            true
                        )
                        ON CONFLICT DO NOTHING
                        """)

                        self.db.execute(
                            insert_tag_query,
                            {
                                "simulation_id": parts[0],
                                "tag_idx": int(parts[1]),
                                "document_id": document_id,
                            },
                        )

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

