package com.thrisual.backend.controllers;

import com.thrisual.backend.models.FileMetadata;
import com.thrisual.backend.models.Folder;
import com.thrisual.backend.models.User;
import com.thrisual.backend.repository.FileMetadataRepository;
import com.thrisual.backend.repository.FolderRepository;
import com.thrisual.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private FolderRepository folderRepository;
    
    @Autowired
    private FileMetadataRepository fileRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/folders")
    public ResponseEntity<?> getFolders(@RequestParam String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) return ResponseEntity.badRequest().build();
        
        List<Folder> folders = folderRepository.findByUserId(userOpt.get().getId());
        return ResponseEntity.ok(folders);
    }

    @PostMapping("/folders")
    public ResponseEntity<?> createFolder(@RequestParam String email, @RequestBody Folder folderReq) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) return ResponseEntity.badRequest().build();
        
        Folder folder = new Folder();
        folder.setName(folderReq.getName() != null && !folderReq.getName().trim().isEmpty() ? folderReq.getName().trim() : "New Folder");
        folder.setUser(userOpt.get());
        folderRepository.save(folder);
        return ResponseEntity.ok(folder);
    }

    @PutMapping("/folders/{folderId}")
    public ResponseEntity<?> renameFolder(@PathVariable Long folderId, @RequestBody Map<String, String> payload) {
        Optional<Folder> folderOpt = folderRepository.findById(folderId);
        if (folderOpt.isEmpty()) return ResponseEntity.notFound().build();
        Folder f = folderOpt.get();
        String newName = payload.get("name");
        if (newName != null && !newName.trim().isEmpty()) {
            f.setName(newName.trim());
            folderRepository.save(f);
        }
        return ResponseEntity.ok(f);
    }

    @DeleteMapping("/folders/{folderId}")
    public ResponseEntity<?> deleteFolder(@PathVariable Long folderId) {
        List<FileMetadata> files = fileRepository.findByFolderId(folderId);
        fileRepository.deleteAll(files);
        folderRepository.deleteById(folderId);
        return ResponseEntity.ok(Map.of("message", "Folder deleted successfully"));
    }

    @PatchMapping("/folders/{folderId}/important")
    public ResponseEntity<?> toggleFolderImportant(@PathVariable Long folderId) {
        Optional<Folder> folderOpt = folderRepository.findById(folderId);
        if (folderOpt.isEmpty()) return ResponseEntity.notFound().build();
        Folder f = folderOpt.get();
        f.setImportant(!f.isImportant());
        folderRepository.save(f);
        return ResponseEntity.ok(f);
    }

    @GetMapping("/files/{folderId}")
    public ResponseEntity<?> getFiles(@PathVariable Long folderId) {
        List<FileMetadata> files = fileRepository.findByFolderId(folderId);
        return ResponseEntity.ok(files);
    }

    @GetMapping("/files/item/{fileId}")
    public ResponseEntity<?> getFileItem(@PathVariable Long fileId) {
        Optional<FileMetadata> fileOpt = fileRepository.findById(fileId);
        if (fileOpt.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(fileOpt.get());
    }

    @PostMapping("/files")
    public ResponseEntity<?> createFile(@RequestBody FileMetadata fileReq) {
        FileMetadata file = new FileMetadata();
        file.setName(fileReq.getName() != null && !fileReq.getName().trim().isEmpty() ? fileReq.getName().trim() : "New Topic Board");
        file.setFolder(fileReq.getFolder());
        file.setFileType(fileReq.getFileType() != null ? fileReq.getFileType() : "board");
        file.setContent(fileReq.getContent());
        fileRepository.save(file);
        return ResponseEntity.ok(file);
    }

    @PutMapping("/files/{fileId}")
    public ResponseEntity<?> updateFile(@PathVariable Long fileId, @RequestBody Map<String, Object> payload) {
        Optional<FileMetadata> fileOpt = fileRepository.findById(fileId);
        if (fileOpt.isEmpty()) return ResponseEntity.notFound().build();
        FileMetadata f = fileOpt.get();
        if (payload.containsKey("name")) {
            f.setName((String) payload.get("name"));
        }
        if (payload.containsKey("content")) {
            f.setContent((String) payload.get("content"));
        }
        fileRepository.save(f);
        return ResponseEntity.ok(f);
    }

    @PatchMapping("/files/{fileId}/important")
    public ResponseEntity<?> toggleFileImportant(@PathVariable Long fileId) {
        Optional<FileMetadata> fileOpt = fileRepository.findById(fileId);
        if (fileOpt.isEmpty()) return ResponseEntity.notFound().build();
        FileMetadata f = fileOpt.get();
        f.setImportant(!f.isImportant());
        fileRepository.save(f);
        return ResponseEntity.ok(f);
    }

    @DeleteMapping("/files/{fileId}")
    public ResponseEntity<?> deleteFile(@PathVariable Long fileId) {
        fileRepository.deleteById(fileId);
        return ResponseEntity.ok(Map.of("message", "File deleted successfully"));
    }
}
