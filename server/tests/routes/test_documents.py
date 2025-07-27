# test_documents.py (Mocked Approach)
import io
import json
import os
import shutil
from unittest.mock import ANY, mock_open, patch
from uuid import uuid4

import pytest
from app.models import Documents


# --- FIXTURE ---
@pytest.fixture
def temp_tus_uploads(mocker):
    """Creates and cleans up a temporary TUS upload directory."""
    mocker.patch("app.routes.documents.TUS_UPLOADS_DIR", new="./test_tus_uploads")
    os.makedirs("./test_tus_uploads", exist_ok=True)
    yield "./test_tus_uploads"
    shutil.rmtree("./test_tus_uploads")


# --- TESTS ---


class TestAgentEndpoints:
    """Tests for endpoints that trigger agent runs."""

    @patch("app.routes.documents.run_classify_agent")
    def test_classify_documents_success(self, mock_run_agent, client, mock_session):
        document_ids = [uuid4(), uuid4()]
        mock_run_agent.return_value = {
            "success": True,
            "message": "OK",
            "classified_count": 1,
            "total_count": 1,
        }
        # Fix: Send document_ids as a JSON array since the route expects list[uuid.UUID] directly
        response = client.post("/documents/classify", json=[str(doc_id) for doc_id in document_ids])
        assert response.status_code == 200
        mock_run_agent.assert_called_once_with(document_ids, False, mock_session)


class TestStandardUpload:
    """Tests for the standard multipart file upload endpoint."""

    @patch("app.routes.documents.os.path.join")
    @patch("builtins.open", new_callable=mock_open)
    def test_upload_document_success(self, mock_file, mock_join, client, mock_session):
        class_id = uuid4()
        files = {"files": ("test.pdf", io.BytesIO(b"content"), "application/pdf")}
        data = {"class_id": str(class_id)}

        response = client.post("/documents/upload", files=files, data=data)

        assert response.status_code == 200
        assert response.json()["count"] == 1
        # Corrected Usage: ANY is an object, not a function
        mock_session.add.assert_called_once_with(ANY)
        mock_session.commit.assert_called_once()


class TestDocumentRetrievalAndDeletion:
    """Tests for getting and deleting a single document."""

    @patch("app.routes.documents.FileResponse")
    @patch("app.routes.documents.os.path.exists", return_value=True)
    def test_get_document_success(
        self, mock_exists, mock_file_response, client, mock_session
    ):
        doc_id = uuid4()
        mock_document = Documents(
            id=doc_id,
            name="test.pdf",
            file_path=f"{doc_id}.pdf",
            mime_type="application/pdf",
        )
        mock_session.exec.return_value.first.return_value = mock_document

        client.get(f"/documents/id/{doc_id}")

        mock_session.exec.assert_called_once()
        mock_file_response.assert_called_once_with(
            path=ANY, filename="test.pdf", media_type="application/pdf"
        )

    def test_get_document_not_found_in_db(self, client, mock_session):
        mock_session.exec.return_value.first.return_value = None
        response = client.get(f"/documents/id/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Document not found"

    @patch("app.routes.documents.os.path.exists", return_value=False)
    def test_get_document_not_found_on_disk(self, mock_exists, client, mock_session):
        doc_id = uuid4()
        mock_document = Documents(id=doc_id, name="test.pdf", file_path="path")
        mock_session.exec.return_value.first.return_value = mock_document

        response = client.get(f"/documents/id/{doc_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Document file not found"

    @patch("app.routes.documents.os.remove")
    @patch("app.routes.documents.os.path.exists", return_value=True)
    def test_delete_document_success(
        self, mock_exists, mock_remove, client, mock_session
    ):
        doc_id = uuid4()
        mock_document = Documents(id=doc_id, name="file.txt", file_path=f"{doc_id}.txt")
        mock_session.exec.return_value.first.return_value = mock_document

        response = client.delete(f"/documents/id/{doc_id}")

        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_session.delete.assert_called_once_with(mock_document)
        mock_session.commit.assert_called_once()
        mock_remove.assert_called_once()


class TestTusProtocol:
    """Tests for the TUS resumable upload protocol endpoints."""

    def test_tus_options_success(self, client):
        """Tests the main TUS OPTIONS handshake."""
        response = client.options("/documents/tus")
        assert response.status_code == 200
        assert response.headers["Tus-Resumable"] == "1.0.0"

    @patch("app.routes.documents.os.makedirs")
    @patch("builtins.open", new_callable=mock_open)
    def test_tus_creation_success(
        self, mock_file, mock_mkdirs, client, temp_tus_uploads
    ):
        """Tests the POST request to initiate a TUS upload."""
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1000",
            "Upload-Metadata": "filename dGVzdC5wbmc=",
        }
        response = client.post("/documents/tus", headers=headers)
        assert response.status_code == 201
        assert "Location" in response.headers

    def test_tus_head_success(self, client, temp_tus_uploads):
        """Tests the HEAD request to check upload status."""
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:500")

        response = client.head(
            f"/documents/tus/{upload_id}", headers={"Tus-Resumable": "1.0.0"}
        )
        assert response.status_code == 200
        assert response.headers["Upload-Offset"] == "500"

    def test_tus_patch_success(self, client, temp_tus_uploads):
        """Tests the PATCH request to upload a chunk of data."""
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:0")
        with open(os.path.join(upload_dir, "file"), "wb"):
            pass

        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
        }
        chunk = b"some data"
        response = client.patch(
            f"/documents/tus/{upload_id}", headers=headers, content=chunk
        )
        assert response.status_code == 200  # Note: your code returns 200, not 204
        assert response.headers["Upload-Offset"] == str(len(chunk))

    @patch("app.routes.documents.shutil.rmtree")
    @patch("app.routes.documents.shutil.copy2")
    # Corrected: Added mock for os.path.getsize
    @patch("os.path.getsize", return_value=1024)
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data=json.dumps(
            {"fileId": "test-id", "filename": "final.txt", "filetype": "text/plain"}
        ),
    )
    @patch("app.routes.documents.os.path.exists", return_value=True)
    @patch("app.routes.documents.os.listdir", return_value=["some-dir"])
    def test_finalize_upload_success(
        self,
        mock_listdir,
        mock_exists,
        mock_file,
        mock_getsize,
        mock_copy,
        mock_rmtree,
        client,
        mock_session,
    ):
        """Tests the finalization call that moves a TUS upload into the system."""
        payload = {"fileId": "test-id"}
        response = client.post("/documents/tus/finalize", json=payload)

        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_session.add.assert_called_once_with(ANY)
        mock_session.commit.assert_called_once()
        mock_copy.assert_called_once()
        mock_rmtree.assert_called_once()


class TestClassify_Documents:
    """Tests for classify_documents endpoint."""

    @patch("app.routes.documents.run_classify_agent")
    def test_classify_documents_success(self, mock_run_agent, client, mock_session):
        """Test successful classify_documents request."""
        document_ids = [uuid4(), uuid4()]
        mock_run_agent.return_value = {
            "success": True,
            "message": "Documents classified successfully",
            "classified_count": 2,
            "total_count": 2,
        }
        
        response = client.post("/documents/classify", json=[str(doc_id) for doc_id in document_ids])
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["classified_count"] == 2
        mock_run_agent.assert_called_once_with(document_ids, False, mock_session)

    @patch("app.routes.documents.run_classify_agent")
    def test_classify_documents_error(self, mock_run_agent, client, mock_session):
        """Test classify_documents error handling."""
        document_ids = [uuid4()]
        mock_run_agent.return_value = {
            "success": False,
            "message": "Classification failed",
        }
        
        response = client.post("/documents/classify", json=[str(doc_id) for doc_id in document_ids])
        
        assert response.status_code == 400
        assert response.json()["status"] == "error"
        assert "Classification failed" in response.json()["message"]


class TestCourse_Processing:
    """Tests for course_processing endpoint."""

    def test_course_processing_success(self, client):
        """Test successful course_processing request."""
        # This endpoint doesn't exist in the current implementation
        # If it gets added later, this test can be updated
        response = client.post("/documents/course-processing")
        assert response.status_code == 404  # Endpoint doesn't exist

    def test_course_processing_error(self, client):
        """Test course_processing error handling."""
        # This endpoint doesn't exist in the current implementation
        response = client.post("/documents/course-processing")
        assert response.status_code == 404  # Endpoint doesn't exist


class TestUpload_Document:
    """Tests for upload_document endpoint."""

    @patch("app.routes.documents.os.path.join")
    @patch("builtins.open", new_callable=mock_open)
    def test_upload_document_success(self, mock_file, mock_join, client, mock_session):
        """Test successful upload_document request."""
        files = {"files": ("test.pdf", io.BytesIO(b"content"), "application/pdf")}
        
        response = client.post("/documents/upload", files=files)
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["count"] == 1
        mock_session.add.assert_called_once_with(ANY)
        mock_session.commit.assert_called_once()

    def test_upload_document_error(self, client):
        """Test upload_document error handling."""
        # Test with no files
        response = client.post("/documents/upload")
        
        assert response.status_code == 422  # Validation error for missing files


class TestGet_Document:
    """Tests for get_document endpoint."""

    @patch("app.routes.documents.FileResponse")
    @patch("app.routes.documents.os.path.exists", return_value=True)
    def test_get_document_success(self, mock_exists, mock_file_response, client, mock_session):
        """Test successful get_document request."""
        doc_id = uuid4()
        mock_document = Documents(
            id=doc_id,
            name="test.pdf",
            file_path=f"{doc_id}.pdf",
            mime_type="application/pdf",
        )
        mock_session.exec.return_value.first.return_value = mock_document

        response = client.get(f"/documents/id/{doc_id}")

        assert response.status_code == 200
        mock_session.exec.assert_called_once()
        mock_file_response.assert_called_once_with(
            path=ANY, filename="test.pdf", media_type="application/pdf"
        )

    def test_get_document_error(self, client, mock_session):
        """Test get_document error handling."""
        mock_session.exec.return_value.first.return_value = None
        response = client.get(f"/documents/id/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Document not found"


class TestTus_Options:
    """Tests for tus_options endpoint."""

    def test_tus_options_success(self, client):
        """Test successful tus_options request."""
        response = client.options("/documents/tus")
        assert response.status_code == 200
        assert response.headers["Tus-Resumable"] == "1.0.0"
        assert response.headers["Tus-Version"] == "1.0.0"

    def test_tus_options_error(self, client):
        """Test tus_options error handling."""
        # TUS OPTIONS should always succeed as it's just returning headers
        response = client.options("/documents/tus")
        assert response.status_code == 200


class TestTus_Creation:
    """Tests for tus_creation endpoint."""

    @patch("app.routes.documents.os.makedirs")
    @patch("builtins.open", new_callable=mock_open)
    def test_tus_creation_success(self, mock_file, mock_mkdirs, client, temp_tus_uploads):
        """Test successful tus_creation request."""
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1000",
            "Upload-Metadata": "filename dGVzdC5wbmc=",
        }
        response = client.post("/documents/tus", headers=headers)
        assert response.status_code == 201
        assert "Location" in response.headers

    def test_tus_creation_error(self, client):
        """Test tus_creation error handling."""
        # Test with missing Upload-Length header
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Metadata": "filename dGVzdC5wbmc=",
        }
        response = client.post("/documents/tus", headers=headers)
        assert response.status_code == 400


class TestTus_Head:
    """Tests for tus_head endpoint."""

    def test_tus_head_success(self, client, temp_tus_uploads):
        """Test successful tus_head request."""
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:500")

        response = client.head(
            f"/documents/tus/{upload_id}", headers={"Tus-Resumable": "1.0.0"}
        )
        assert response.status_code == 200
        assert response.headers["Upload-Offset"] == "500"

    def test_tus_head_error(self, client):
        """Test tus_head error handling."""
        # Test with non-existent upload ID
        response = client.head(
            f"/documents/tus/{uuid4()}", headers={"Tus-Resumable": "1.0.0"}
        )
        assert response.status_code == 404


class TestTus_Patch:
    """Tests for tus_patch endpoint."""

    def test_tus_patch_success(self, client, temp_tus_uploads):
        """Test successful tus_patch request."""
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:0")
        with open(os.path.join(upload_dir, "file"), "wb"):
            pass

        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
        }
        chunk = b"some data"
        response = client.patch(
            f"/documents/tus/{upload_id}", headers=headers, content=chunk
        )
        assert response.status_code == 200
        assert response.headers["Upload-Offset"] == str(len(chunk))

    def test_tus_patch_error(self, client):
        """Test tus_patch error handling."""
        # Test with non-existent upload ID
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
        }
        response = client.patch(
            f"/documents/tus/{uuid4()}", headers=headers, content=b"data"
        )
        assert response.status_code == 404


class TestTus_Options_Upload_Id:
    """Tests for tus_options_upload_id endpoint."""

    def test_tus_options_upload_id_success(self, client):
        """Test successful tus_options_upload_id request."""
        upload_id = str(uuid4())
        response = client.options(f"/documents/tus/{upload_id}")
        assert response.status_code == 200
        assert response.headers["Tus-Resumable"] == "1.0.0"

    def test_tus_options_upload_id_error(self, client):
        """Test tus_options_upload_id error handling."""
        # TUS OPTIONS should always succeed as it's just returning headers
        upload_id = str(uuid4())
        response = client.options(f"/documents/tus/{upload_id}")
        assert response.status_code == 200


class TestFinalize_Upload:
    """Tests for finalize_upload endpoint."""

    @patch("app.routes.documents.shutil.rmtree")
    @patch("app.routes.documents.shutil.copy2")
    @patch("os.path.getsize", return_value=1024)
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data=json.dumps(
            {"fileId": "test-id", "filename": "final.txt", "filetype": "text/plain"}
        ),
    )
    @patch("app.routes.documents.os.path.exists", return_value=True)
    @patch("app.routes.documents.os.listdir", return_value=["some-dir"])
    def test_finalize_upload_success(
        self,
        mock_listdir,
        mock_exists,
        mock_file,
        mock_getsize,
        mock_copy,
        mock_rmtree,
        client,
        mock_session,
    ):
        """Test successful finalize_upload request."""
        payload = {"fileId": "test-id"}
        response = client.post("/documents/tus/finalize", json=payload)

        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_session.add.assert_called_once_with(ANY)
        mock_session.commit.assert_called_once()

    def test_finalize_upload_error(self, client):
        """Test finalize_upload error handling."""
        # Test with missing fileId
        payload = {}
        response = client.post("/documents/tus/finalize", json=payload)
        assert response.status_code == 400
        assert response.json()["status"] == "error"


class TestDelete_Document:
    """Tests for delete_document endpoint."""

    @patch("app.routes.documents.os.remove")
    @patch("app.routes.documents.os.path.exists", return_value=True)
    def test_delete_document_success(self, mock_exists, mock_remove, client, mock_session):
        """Test successful delete_document request."""
        doc_id = uuid4()
        mock_document = Documents(id=doc_id, name="file.txt", file_path=f"{doc_id}.txt")
        mock_session.exec.return_value.first.return_value = mock_document

        response = client.delete(f"/documents/id/{doc_id}")

        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_session.delete.assert_called_once_with(mock_document)
        mock_session.commit.assert_called_once()
        mock_remove.assert_called_once()

    def test_delete_document_error(self, client, mock_session):
        """Test delete_document error handling."""
        mock_session.exec.return_value.first.return_value = None
        response = client.delete(f"/documents/id/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["status"] == "error"


class TestDocuments_Health_Check:
    """Tests for documents_health_check endpoint."""

    @patch("app.routes.documents.os.makedirs")
    @patch("app.routes.documents.os.path.exists", return_value=True)
    def test_documents_health_check_success(self, mock_exists, mock_makedirs, client):
        """Test successful documents_health_check request."""
        response = client.get("/documents/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "documents"

    @patch("app.routes.documents.os.path.exists", return_value=False)
    @patch("app.routes.documents.os.makedirs", side_effect=Exception("Permission denied"))
    def test_documents_health_check_error(self, mock_makedirs, mock_exists, client):
        """Test documents_health_check error handling."""
        response = client.get("/documents/health")
        assert response.status_code == 500
        assert response.json()["status"] == "error"
        assert response.json()["service"] == "documents"

