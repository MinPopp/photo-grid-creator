(() => {
    const MAX_SIZE = 1500;

    const grid = document.getElementById("grid");
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const colsInput = document.getElementById("cols");
    const rowsInput = document.getElementById("rows");
    const borderSizeInput = document.getElementById("border-size");
    const borderSizeValue = document.getElementById("border-size-value");
    const borderColorInput = document.getElementById("border-color");
    const downloadBtn = document.getElementById("download-btn");

    // Fixed-size array: null = empty slot, otherwise a canvas with the cropped square image
    let images = [];
    let dragSourceIndex = null;

    // --- Image processing ---

    function cropToSquare(img) {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const targetSize = Math.min(size, MAX_SIZE);
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        const sx = (img.naturalWidth - size) / 2;
        const sy = (img.naturalHeight - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);
        return canvas;
    }

    function loadImageFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith("image/")) return reject(new Error("Not an image"));
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const canvas = cropToSquare(img);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image"));
            };
            img.src = url;
        });
    }

    function ensureArraySize() {
        const totalSlots = getCols() * getRows();
        while (images.length < totalSlots) images.push(null);
        if (images.length > totalSlots) images.length = totalSlots;
    }

    async function addFiles(files) {
        ensureArraySize();
        for (const file of files) {
            const emptyIndex = images.indexOf(null);
            if (emptyIndex === -1) break;
            try {
                const canvas = await loadImageFile(file);
                images[emptyIndex] = canvas;
            } catch (_) {
                // skip non-images silently
            }
        }
        renderGrid();
    }

    // --- Grid helpers ---

    function getCols() {
        return Math.max(1, Math.min(10, parseInt(colsInput.value) || 3));
    }

    function getRows() {
        return Math.max(1, Math.min(10, parseInt(rowsInput.value) || 3));
    }

    function getBorderSize() {
        return parseInt(borderSizeInput.value) || 0;
    }

    function getBorderColor() {
        return borderColorInput.value;
    }

    // --- Rendering ---

    function renderGrid() {
        const cols = getCols();
        const rows = getRows();
        const totalSlots = cols * rows;
        const border = getBorderSize();
        const color = getBorderColor();

        ensureArraySize();

        const hasAnyImage = images.some((img) => img !== null);

        if (!hasAnyImage) {
            grid.style.display = "none";
            dropZone.style.display = "";
            downloadBtn.disabled = true;
            return;
        }

        dropZone.style.display = "none";
        grid.style.display = "";
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.gap = `${border}px`;
        grid.style.padding = `${border}px`;
        grid.style.background = color;

        grid.innerHTML = "";

        for (let i = 0; i < totalSlots; i++) {
            const canvas = images[i];

            if (canvas) {
                const cell = document.createElement("div");
                cell.className = "grid-cell";
                cell.dataset.index = i;
                cell.draggable = true;

                cell.addEventListener("dragstart", (e) => {
                    dragSourceIndex = i;
                    cell.classList.add("dragging");
                    e.dataTransfer.effectAllowed = "move";
                });
                cell.addEventListener("dragend", () => {
                    cell.classList.remove("dragging");
                    dragSourceIndex = null;
                    grid.querySelectorAll(".drag-target").forEach((el) => el.classList.remove("drag-target"));
                });
                cell.addEventListener("dragover", (e) => {
                    if (dragSourceIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    cell.classList.add("drag-target");
                });
                cell.addEventListener("dragleave", () => cell.classList.remove("drag-target"));
                cell.addEventListener("drop", (e) => {
                    e.preventDefault();
                    cell.classList.remove("drag-target");
                    if (dragSourceIndex === null || dragSourceIndex === i) return;
                    const tmp = images[dragSourceIndex];
                    images[dragSourceIndex] = images[i];
                    images[i] = tmp;
                    dragSourceIndex = null;
                    renderGrid();
                });

                const img = document.createElement("img");
                img.src = canvas.toDataURL("image/jpeg", 0.92);
                cell.appendChild(img);

                const removeBtn = document.createElement("button");
                removeBtn.className = "remove-btn";
                removeBtn.textContent = "✕";
                removeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    images[i] = null;
                    renderGrid();
                });
                cell.appendChild(removeBtn);

                grid.appendChild(cell);
            } else {
                const cell = document.createElement("div");
                cell.className = "grid-cell empty-cell";
                cell.dataset.index = i;

                cell.addEventListener("dragover", (e) => {
                    if (dragSourceIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    cell.classList.add("drag-target");
                });
                cell.addEventListener("dragleave", () => cell.classList.remove("drag-target"));
                cell.addEventListener("drop", (e) => {
                    e.preventDefault();
                    cell.classList.remove("drag-target");
                    if (dragSourceIndex === null) return;
                    images[i] = images[dragSourceIndex];
                    images[dragSourceIndex] = null;
                    dragSourceIndex = null;
                    renderGrid();
                });

                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = "image/*";
                input.addEventListener("change", (e) => addFiles(e.target.files));
                cell.appendChild(input);

                cell.addEventListener("click", () => input.click());
                grid.appendChild(cell);
            }
        }

        downloadBtn.disabled = !hasAnyImage;
    }

    // --- Download ---

    function downloadGrid() {
        downloadBtn.disabled = true;
        downloadBtn.textContent = "Preparing…";

        // Defer heavy work so the button text update renders first
        setTimeout(() => {
            const cols = getCols();
            const rows = getRows();
            const border = getBorderSize();
            const color = getBorderColor();
            const cellSize = MAX_SIZE;

            const width = cols * cellSize + (cols + 1) * border;
            const height = rows * cellSize + (rows + 1) * border;

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // Background = border color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);

            images.forEach((imgCanvas, i) => {
                if (!imgCanvas) return;
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = border + col * (cellSize + border);
                const y = border + row * (cellSize + border);
                ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height, x, y, cellSize, cellSize);
            });

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "photo-grid.png";
                a.click();
                URL.revokeObjectURL(url);

                downloadBtn.textContent = "Download";
                downloadBtn.disabled = false;
            }, "image/png");
        }, 50);
    }

    // --- Events ---

    // Drop zone
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => addFiles(e.target.files));

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        addFiles(e.dataTransfer.files);
    });

    // Also allow dropping on the grid itself
    grid.addEventListener("dragover", (e) => e.preventDefault());
    grid.addEventListener("drop", (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    });

    // Controls
    colsInput.addEventListener("change", renderGrid);
    rowsInput.addEventListener("change", renderGrid);

    borderSizeInput.addEventListener("input", () => {
        borderSizeValue.textContent = borderSizeInput.value;
        grid.style.gap = `${getBorderSize()}px`;
        grid.style.padding = `${getBorderSize()}px`;
    });

    borderColorInput.addEventListener("input", () => {
        grid.style.background = getBorderColor();
    });

    downloadBtn.addEventListener("click", downloadGrid);
})();
