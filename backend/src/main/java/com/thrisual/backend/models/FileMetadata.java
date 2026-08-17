package com.thrisual.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "files")
public class FileMetadata {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user"})
    private Folder folder;

    private boolean isImportant;
    private String fileType; // e.g., "board" for smartboard, or "pdf", "ppt"
    private Long size;
    private String storagePath; // Path on disk

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content; // JSON string of saved strokes, text, and embeds

    @CreationTimestamp
    private LocalDateTime createdAt;
}
