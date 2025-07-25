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
        class_id = uuid4()
        mock_run_agent.return_value = {
            "success": True,
            "message": "OK",
            "classified_count": 1,
            "total_count": 1,
        }
        response = client.post(f"/documents/classify?class_id={class_id}")
        assert response.status_code == 200
        mock_run_agent.assert_called_once_with(class_id, False, mock_session)


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


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `classify_documents`")
class TestClassify_Documents:
    """Tests for classify_documents endpoint."""

    def test_classify_documents_success(self, client):
        """Test successful classify_documents request."""
        # TODO: Implement test for classify_documents
        assert False, "IMPLEMENT: Test for classify_documents"

    def test_classify_documents_error(self, client):
        """Test classify_documents error handling."""
        # TODO: Implement error test for classify_documents
        assert False, "IMPLEMENT: Error test for classify_documents"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `course_processing`")
class TestCourse_Processing:
    """Tests for course_processing endpoint."""

    def test_course_processing_success(self, client):
        """Test successful course_processing request."""
        # TODO: Implement test for course_processing
        assert False, "IMPLEMENT: Test for course_processing"

    def test_course_processing_error(self, client):
        """Test course_processing error handling."""
        # TODO: Implement error test for course_processing
        assert False, "IMPLEMENT: Error test for course_processing"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `upload_document`")
class TestUpload_Document:
    """Tests for upload_document endpoint."""

    def test_upload_document_success(self, client):
        """Test successful upload_document request."""
        # TODO: Implement test for upload_document
        assert False, "IMPLEMENT: Test for upload_document"

    def test_upload_document_error(self, client):
        """Test upload_document error handling."""
        # TODO: Implement error test for upload_document
        assert False, "IMPLEMENT: Error test for upload_document"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `get_document`")
class TestGet_Document:
    """Tests for get_document endpoint."""

    def test_get_document_success(self, client):
        """Test successful get_document request."""
        # TODO: Implement test for get_document
        assert False, "IMPLEMENT: Test for get_document"

    def test_get_document_error(self, client):
        """Test get_document error handling."""
        # TODO: Implement error test for get_document
        assert False, "IMPLEMENT: Error test for get_document"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `tus_options`")
class TestTus_Options:
    """Tests for tus_options endpoint."""

    def test_tus_options_success(self, client):
        """Test successful tus_options request."""
        # TODO: Implement test for tus_options
        assert False, "IMPLEMENT: Test for tus_options"

    def test_tus_options_error(self, client):
        """Test tus_options error handling."""
        # TODO: Implement error test for tus_options
        assert False, "IMPLEMENT: Error test for tus_options"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `tus_creation`")
class TestTus_Creation:
    """Tests for tus_creation endpoint."""

    def test_tus_creation_success(self, client):
        """Test successful tus_creation request."""
        # TODO: Implement test for tus_creation
        assert False, "IMPLEMENT: Test for tus_creation"

    def test_tus_creation_error(self, client):
        """Test tus_creation error handling."""
        # TODO: Implement error test for tus_creation
        assert False, "IMPLEMENT: Error test for tus_creation"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `tus_head`")
class TestTus_Head:
    """Tests for tus_head endpoint."""

    def test_tus_head_success(self, client):
        """Test successful tus_head request."""
        # TODO: Implement test for tus_head
        assert False, "IMPLEMENT: Test for tus_head"

    def test_tus_head_error(self, client):
        """Test tus_head error handling."""
        # TODO: Implement error test for tus_head
        assert False, "IMPLEMENT: Error test for tus_head"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `tus_patch`")
class TestTus_Patch:
    """Tests for tus_patch endpoint."""

    def test_tus_patch_success(self, client):
        """Test successful tus_patch request."""
        # TODO: Implement test for tus_patch
        assert False, "IMPLEMENT: Test for tus_patch"

    def test_tus_patch_error(self, client):
        """Test tus_patch error handling."""
        # TODO: Implement error test for tus_patch
        assert False, "IMPLEMENT: Error test for tus_patch"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `tus_options_upload_id`")
class TestTus_Options_Upload_Id:
    """Tests for tus_options_upload_id endpoint."""

    def test_tus_options_upload_id_success(self, client):
        """Test successful tus_options_upload_id request."""
        # TODO: Implement test for tus_options_upload_id
        assert False, "IMPLEMENT: Test for tus_options_upload_id"

    def test_tus_options_upload_id_error(self, client):
        """Test tus_options_upload_id error handling."""
        # TODO: Implement error test for tus_options_upload_id
        assert False, "IMPLEMENT: Error test for tus_options_upload_id"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `finalize_upload`")
class TestFinalize_Upload:
    """Tests for finalize_upload endpoint."""

    def test_finalize_upload_success(self, client):
        """Test successful finalize_upload request."""
        # TODO: Implement test for finalize_upload
        assert False, "IMPLEMENT: Test for finalize_upload"

    def test_finalize_upload_error(self, client):
        """Test finalize_upload error handling."""
        # TODO: Implement error test for finalize_upload
        assert False, "IMPLEMENT: Error test for finalize_upload"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `delete_document`")
class TestDelete_Document:
    """Tests for delete_document endpoint."""

    def test_delete_document_success(self, client):
        """Test successful delete_document request."""
        # TODO: Implement test for delete_document
        assert False, "IMPLEMENT: Test for delete_document"

    def test_delete_document_error(self, client):
        """Test delete_document error handling."""
        # TODO: Implement error test for delete_document
        assert False, "IMPLEMENT: Error test for delete_document"

import pytest


@pytest.mark.skip(reason="TODO: implement tests for `documents_health_check`")
class TestDocuments_Health_Check:
    """Tests for documents_health_check endpoint."""

    def test_documents_health_check_success(self, client):
        """Test successful documents_health_check request."""
        # TODO: Implement test for documents_health_check
        assert False, "IMPLEMENT: Test for documents_health_check"

    def test_documents_health_check_error(self, client):
        """Test documents_health_check error handling."""
        # TODO: Implement error test for documents_health_check
        assert False, "IMPLEMENT: Error test for documents_health_check"

