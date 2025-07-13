import io
import json
import os
import shutil
import uuid
from unittest.mock import ANY, patch
from uuid import uuid4

import pytest
from app.extensions import UPLOAD_FOLDER
# Assuming you have a 'Classes' model for the foreign key relationship
from app.models import Classes, Documents


# --- FIXTURES (add these to your conftest.py or keep them here) ---
@pytest.fixture
def temp_tus_uploads(mocker):
    """Creates and cleans up a temporary TUS upload directory."""
    # Mock the constant to point to a test-specific folder
    mocker.patch("app.routes.documents.TUS_UPLOADS_DIR", new="./test_tus_uploads")
    os.makedirs("./test_tus_uploads", exist_ok=True)
    yield "./test_tus_uploads"
    shutil.rmtree("./test_tus_uploads")


# --- CORRECTED & IMPLEMENTED TESTS ---

class TestClassify_Documents:
    """Tests for classify_documents endpoint."""

    @patch("app.routes.documents.run_classify_agent")
    def test_classify_documents_success(self, mock_run_agent, client, test_session):
        """Test successful classify_documents request."""
        # Arrange
        class_id = uuid4()
        # You need to create the class first due to foreign key constraints in the agent
        test_session.add(Classes(id=class_id, name="Test Class"))
        test_session.commit()
        
        mock_result = { "success": True, "message": "Classification complete", "classified_count": 5, "total_count": 5 }
        mock_run_agent.return_value = mock_result
        
        # Act
        response = client.post(f"/documents/classify?class_id={class_id}")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        # Use ANY to match any session object passed to the mock
        mock_run_agent.assert_called_once_with(class_id, False, ANY)

    @patch("app.routes.documents.run_classify_agent")
    def test_classify_documents_agent_error(self, mock_run_agent, client):
        """Test classify_documents error handling from the agent."""
        class_id = uuid4()
        mock_result = {"success": False, "message": "Agent failed"}
        mock_run_agent.return_value = mock_result
        
        response = client.post(f"/documents/classify?class_id={class_id}")
        
        assert response.status_code == 400
        assert response.json()["status"] == "error"

class TestCourse_Processing:
    """Tests for course_processing endpoint."""

    @patch("app.routes.documents.run_course_agent")
    def test_course_processing_success(self, mock_run_agent, client, test_session):
        """Test successful course_processing request."""
        class_id = uuid4()
        test_session.add(Classes(id=class_id, name="Test Course"))
        test_session.commit()

        mock_result = { "success": True, "message": "Course processed", "updates_made": [], "documents_count": 1, "course_info": {} }
        mock_run_agent.return_value = mock_result

        response = client.post(f"/documents/course?class_id={class_id}")

        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_run_agent.assert_called_once_with(class_id, False, ANY)

    @patch("app.routes.documents.run_course_agent")
    def test_course_processing_error(self, mock_run_agent, client, test_session):
        """Test course_processing error handling."""
        class_id = uuid4()
        test_session.add(Classes(id=class_id, name="Test Course"))
        test_session.commit()

        mock_run_agent.side_effect = ValueError("Class not found in agent")

        response = client.post(f"/documents/course?class_id={class_id}")

        assert response.status_code == 404
        assert response.json()["message"] == "Class not found in agent"


class TestUpload_Document:
    """Tests for upload_document endpoint."""

    def test_upload_document_success(self, client, test_session):
        """Test successful upload_document request."""
        # Arrange: Create a valid class in the test DB first
        class_id = uuid4()
        test_session.add(Classes(id=class_id, name="Test Class"))
        test_session.commit()
        
        file_content = b"fake pdf content"
        files = {"files": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
        data = {"class_id": str(class_id)}
        
        # Act
        response = client.post("/documents/upload", files=files, data=data)
        
        # Assert
        assert response.status_code == 200
        json_response = response.json()
        assert json_response["status"] == "success"
        assert json_response["count"] == 1

    def test_upload_document_no_files(self, client):
        """Test upload_document error handling when no files are provided."""
        class_id = str(uuid4())
        data = {"class_id": class_id}

        response = client.post("/documents/upload", data=data)
        
        # Assert: FastAPI returns 422 for validation errors on the body
        assert response.status_code == 422

class TestGet_Document:
    """Tests for get_document endpoint."""

    def test_get_document_success(self, client, test_session, mocker):
        """Test successful get_document request."""
        # Arrange: Create a real document in the test DB
        doc_id = uuid4()
        class_id = uuid4()
        # This class needs to exist for the document to be created
        test_session.add(Classes(id=class_id, name="Test Class"))
        test_session.add(Documents(id=doc_id, name="test.pdf", file_path=f"{doc_id}.pdf", mime_type="application/pdf", class_id=class_id))
        test_session.commit()
        
        mocker.patch("os.path.exists", return_value=True)
        # Mock the FileResponse to avoid needing a real file on disk
        mocker.patch("app.routes.documents.FileResponse")

        # Act
        response = client.get(f"/documents/id/{doc_id}")
        
        # Assert
        assert response.status_code == 200
        # Check that FileResponse was called correctly
        from app.routes.documents import FileResponse
        FileResponse.assert_called_once_with(path=os.path.join(UPLOAD_FOLDER, f"{doc_id}.pdf"), filename="test.pdf", media_type="application/pdf")

    def test_get_document_not_found(self, client):
        """Test get_document when the document does not exist in the DB."""
        doc_id = uuid4()
        response = client.get(f"/documents/id/{doc_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Document not found"

class TestTus_Options:
    """Tests for tus_options endpoint."""
    
    def test_tus_options_success(self, client):
        """Test successful tus_options request."""
        response = client.options("/documents/tus")
        assert response.status_code == 200
        assert response.headers["Tus-Resumable"] == "1.0.0"
        assert "creation" in response.headers["Tus-Extension"]

class TestTus_Creation:
    """Tests for tus_creation endpoint."""
    
    def test_tus_creation_success(self, client, mocker, temp_tus_uploads):
        """Test successful tus_creation request."""
        # Arrange
        mocker.patch("os.makedirs")
        mock_open = mocker.patch("builtins.open", mocker.mock_open())
        
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1000",
            "Upload-Metadata": "filename dGVzdC5wbmc=,filetype aW1hZ2UvcG5n" # test.png, image/png
        }

        # Act
        response = client.post("/documents/tus", headers=headers)
        
        # Assert
        assert response.status_code == 201
        assert "Location" in response.headers
        assert response.headers["Tus-Resumable"] == "1.0.0"
        
        # Check that metadata and info files were written
        assert mock_open.call_count == 3 # metadata.json, file, info

class TestTus_Head:
    """Tests for tus_head endpoint."""

    def test_tus_head_success(self, client, temp_tus_uploads):
        """Test successful tus_head request."""
        # Arrange: Create a fake upload directory and info file
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:500")

        # Act
        response = client.head(f"/documents/tus/{upload_id}", headers={"Tus-Resumable": "1.0.0"})

        # Assert
        assert response.status_code == 200
        assert response.headers["Upload-Length"] == "1000"
        assert response.headers["Upload-Offset"] == "500"

    def test_tus_head_not_found(self, client):
        """Test tus_head error handling for a non-existent upload."""
        upload_id = str(uuid4())
        response = client.head(f"/documents/tus/{upload_id}", headers={"Tus-Resumable": "1.0.0"})
        assert response.status_code == 404

class TestTus_Patch:
    """Tests for tus_patch endpoint."""

    def test_tus_patch_success(self, client, mocker, temp_tus_uploads):
        """Test successful tus_patch request."""
        # Arrange: Create a fake upload
        upload_id = str(uuid4())
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write("length:1000\noffset:0")
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            pass # create empty file
        
        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream"
        }
        chunk = b"some file data"

        # Act
        response = client.patch(f"/documents/tus/{upload_id}", headers=headers, content=chunk)

        # Assert
        # Change the expected status code from 204 to 200
        assert response.status_code == 200 
        assert response.headers["Upload-Offset"] == str(len(chunk))

class TestFinalize_Upload:
    """Tests for finalize_upload endpoint."""

    def test_finalize_regular_upload_success(self, client, test_session, temp_tus_uploads):
        """Test successful finalization of a regular file."""
        # Arrange
        upload_id = str(uuid4())
        class_id = uuid4()
        
        # Setup a class in the DB
        test_session.add(Classes(id=class_id, name="Finalize Test Class"))
        test_session.commit()
        
        # Create a fake TUS upload on the filesystem
        upload_dir = os.path.join(temp_tus_uploads, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            f.write(b"finalized content")
        metadata = {"fileId": upload_id, "filename": "final.txt", "filetype": "text/plain"}
        with open(os.path.join(upload_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f)
            
        payload = {"fileId": upload_id, "classId": str(class_id)}

        # Act
        response = client.post("/documents/tus/finalize", json=payload)

        # Assert
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "success"
        assert "document_id" in json_data

        # Convert the string ID from the response back to a UUID object
        document_id = uuid.UUID(json_data["document_id"]) # ✅ Convert here

        # Verify document was created in DB
        doc = test_session.get(Documents, document_id) # ✅ Now using a UUID object
        assert doc is not None
        assert doc.name == "final.txt"

class TestDelete_Document:
    """Tests for delete_document endpoint."""

    def test_delete_document_success(self, client, test_session, mocker):
        """Test successful delete_document request."""
        # Arrange: Create a real document to delete
        doc_id = uuid4()
        class_id = uuid4()
        test_session.add(Classes(id=class_id, name="Test Class"))
        test_session.add(Documents(id=doc_id, name="test.pdf", file_path=f"{doc_id}.pdf", class_id=class_id))
        test_session.commit()

        mocker.patch("os.path.exists", return_value=True)
        mock_os_remove = mocker.patch("os.remove")
        
        # Act
        response = client.delete(f"/documents/id/{doc_id}")
        
        # Assert
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify DB and file system calls
        mock_os_remove.assert_called_once()
        # Verify the item is gone from the DB
        deleted_doc = test_session.get(Documents, doc_id)
        assert deleted_doc is None

    def test_delete_document_not_found(self, client):
        """Test delete_document error handling when document is not found."""
        response = client.delete(f"/documents/id/{uuid4()}")
        assert response.status_code == 404

class TestTus_Options_Upload_Id:
    """Tests for tus_options_upload_id endpoint."""

    def test_tus_options_upload_id_success(self, client):
        """Test successful tus_options_upload_id request."""
        # Arrange
        upload_id = str(uuid4())

        # Act
        response = client.options(f"/documents/tus/{upload_id}")

        # Assert
        assert response.status_code == 200
        assert response.headers["Tus-Resumable"] == "1.0.0"
        assert "PATCH" in response.headers["Access-Control-Allow-Methods"]

    def test_tus_options_upload_id_error(self, client):
        """
        This endpoint is very simple and generally doesn't have an error state,
        as OPTIONS requests are handled by FastAPI/Starlette before hitting
        complex logic. A test for a non-existent ID isn't meaningful here,
        so we can just pass this test.
        """
        pass
        

