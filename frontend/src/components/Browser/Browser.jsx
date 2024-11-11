import React, { useState, useEffect } from 'react';
import FolderItem from './FolderItem';
import SearchBar from './SearchBar';
import '../../styles/pages/browser.scss';

const Browser = ({ token, userId }) => {
  const [folders, setFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState({ field: 'name', ascending: true });

  const fetchFolders = async (userId, depth = 5) => {
    try {
      const response = await fetch(`http://localhost:4000/api/projects/${userId}?depth=${depth}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setFolders(data.projects);
      } else {
        console.error('Error fetching folders:', data);
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    }
  };
  useEffect(() => {
    if (userId && token) {
      fetchFolders(userId);
    }
  }, [userId, token]);

  const onAddNestedProject = async (parentId) => {
    try {
        const response = await fetch(`http://localhost:4000/api/projects/${parentId}/nest-new`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, name: "New Project" }),
        });
        const data = await response.json();
        if (response.ok) {
            fetchFolders(userId);
        } else {
          console.error('Error adding nested project:', data.message);
        }
      } catch (error) {
        console.error('Error adding nested project:', error);
      }
  };

  const onDeleteProject = async (nestedProjectId) => {
    try {
      const response = await fetch(`http://localhost:4000/api/projects/${nestedProjectId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        fetchFolders(userId);
      } else {
        console.error('Error deleting project:', response.statusText);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleEditSurname = async (userId, surname) => {
    try {
      const response = await fetch(`http://localhost:4000/api/projects/${userId}/update-surname`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ surname }),
    });
    if (response.ok) {
        setFolders((prevFolders) =>
            prevFolders.map((folder) => folder._id === userId ? { ...folder, surname } : folder)
        );
    } else {
        console.error('Error editing surname:', response);
    }
    } catch (error) {
        console.error('Error editing surname:', error);
    }};

  const handleSearch = (searchTerm) => {
    setSearchTerm(searchTerm);
  };

  const handleSort = (field) => {
    const isAscending = sortOption.field === field ? !sortOption.ascending : true;
    setSortOption({ field, ascending: isAscending });
  };

  const filteredFolders = folders
    .filter((folder) => 
      typeof searchTerm === 'string' && folder.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const order = sortOption.ascending ? 1 : -1;
      if (sortOption.field === 'name') return a.name.localeCompare(b.name) * order;
      if (sortOption.field === 'date') return a.latestStatusUpdate.localeCompare(b.latestStatusUpdate) * order;
      return 0;
    });

    const handleFileImport = async (folderId) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/jpeg, image/png, image/jpg';
        fileInput.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('image', file);
            formData.append('userId', userId);
            formData.append('projectId', folderId);
            formData.append('surname', folderId);

            try {
                const response = await fetch(`http://localhost:4000/api/files/${folderId}/add`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
            const data = await response.json();
            if (response.ok) {
                console.log('File uploaded successfully:', data);
                fetchFolders(userId); // Refresh the folders after upload
            } else {
                console.error('Error uploading file:', data);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };
    fileInput.click();
    };

    const handleDeleteFile = async (fileId) => {
        try {
          const response = await fetch(`http://localhost:4000/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            console.log('File deleted successfully');
            fetchFolders(userId); // Refresh the folders after deletion
          } else {
            console.error('Error deleting file');
          }
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      };

    return (
        <div className="browser">
        <SearchBar searchTerm={searchTerm} onSearch={handleSearch} onSort={() => handleSort("name")} />
        <div className="folder-list">
          {filteredFolders.map((folder) => (
            <FolderItem
                key={folder._id}
                folder={folder} 
                onEditSurname={handleEditSurname}
                onAddNestedProject={onAddNestedProject}
                onDeleteProject={onDeleteProject}
                handleFileImport={handleFileImport}
                handleDeleteFile={handleDeleteFile} />
          ))}
        </div>
      </div>
    );
};
    
export default Browser;