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
    const includeColorCheckbox = document.getElementById("include-color");
    const downloadFormat = document.getElementById("download-format");

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

    function getContrastColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? "#000000" : "#FFFFFF";
    }

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
            const format = downloadFormat.value;
            const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
            const quality = format === "jpeg" ? 0.92 : undefined;

            const gridWidth = cols * cellSize + (cols + 1) * border;
            const gridHeight = rows * cellSize + (rows + 1) * border;

            // Color header
            const showColor = includeColorCheckbox.checked && currentColor;
            const headerHeight = showColor ? 120 : 0;

            const canvas = document.createElement("canvas");
            canvas.width = gridWidth;
            canvas.height = gridHeight + headerHeight;
            const ctx = canvas.getContext("2d");

            // Background = border color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw color header
            if (showColor) {
                const swatchSize = 80;
                const padding = 20;

                // Swatch
                ctx.fillStyle = currentColor.hex;
                ctx.fillRect(padding, padding, swatchSize, swatchSize);
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.lineWidth = 2;
                ctx.strokeRect(padding, padding, swatchSize, swatchSize);

                // Text
                const textX = padding + swatchSize + 20;
                const textColor = getContrastColor(color);
                ctx.fillStyle = textColor;
                ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.textBaseline = "top";
                ctx.fillText(currentColor.name, textX, padding + 4);
                ctx.font = "36px monospace";
                ctx.fillStyle = textColor === "#FFFFFF" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
                ctx.fillText(currentColor.hex, textX, padding + 56);
            }

            images.forEach((imgCanvas, i) => {
                if (!imgCanvas) return;
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = border + col * (cellSize + border);
                const y = headerHeight + border + row * (cellSize + border);
                ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height, x, y, cellSize, cellSize);
            });

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `photo-grid.${format}`;
                a.click();
                URL.revokeObjectURL(url);

                downloadBtn.textContent = "Download";
                downloadBtn.disabled = false;
            }, mimeType, quality);
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

    // --- Color Challenge ---

    let currentColor = null;

    const PALETTE_SMALL = [
        ["Red", "#E53935"],
        ["Orange", "#FB8C00"],
        ["Yellow", "#FDD835"],
        ["Lime", "#7CB342"],
        ["Green", "#43A047"],
        ["Teal", "#00897B"],
        ["Sky Blue", "#039BE5"],
        ["Blue", "#1E88E5"],
        ["Indigo", "#3949AB"],
        ["Purple", "#8E24AA"],
        ["Pink", "#D81B60"],
        ["Brown", "#6D4C41"],
    ];

    const PALETTE_REGULAR = [
        ["Scarlet", "#FF2400"],
        ["Crimson", "#DC143C"],
        ["Coral", "#FF6F61"],
        ["Tomato", "#FF6347"],
        ["Burnt Orange", "#CC5500"],
        ["Tangerine", "#FF9966"],
        ["Amber", "#FFBF00"],
        ["Gold", "#FFD700"],
        ["Lemon", "#FFF44F"],
        ["Chartreuse", "#DFFF00"],
        ["Lime", "#A4DE02"],
        ["Mint", "#98FF98"],
        ["Emerald", "#50C878"],
        ["Forest Green", "#228B22"],
        ["Sage", "#87AE73"],
        ["Teal", "#008080"],
        ["Cyan", "#00BCD4"],
        ["Sky Blue", "#87CEEB"],
        ["Cerulean", "#007BA7"],
        ["Cobalt", "#0047AB"],
        ["Navy", "#001F3F"],
        ["Periwinkle", "#CCCCFF"],
        ["Lavender", "#B57EDC"],
        ["Violet", "#7F00FF"],
        ["Plum", "#8E4585"],
        ["Magenta", "#FF00FF"],
        ["Rose", "#FF007F"],
        ["Blush", "#DE5D83"],
        ["Peach", "#FFCBA4"],
        ["Rust", "#B7410E"],
        ["Maroon", "#800000"],
        ["Chocolate", "#7B3F00"],
        ["Taupe", "#8B8589"],
        ["Slate", "#708090"],
        ["Ivory", "#FFFFF0"],
        ["Mustard", "#FFDB58"],
    ];

    const rollBtn = document.getElementById("roll-btn");
    const paletteMode = document.getElementById("palette-mode");
    const colorResult = document.getElementById("color-result");
    const colorSwatch = document.getElementById("color-swatch");
    const colorName = document.getElementById("color-name");
    const colorHex = document.getElementById("color-hex");
    const shareColorBtn = document.getElementById("share-color-btn");

    function showColor(name, hex) {
        currentColor = { name, hex };
        colorSwatch.style.background = hex;
        colorName.textContent = name;
        colorHex.textContent = hex;
        colorResult.classList.remove("hidden");
    }

    function rollColor() {
        const mode = paletteMode.value;
        let name, hex;

        if (mode === "random") {
            hex = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
            name = "Random";
        } else {
            const palette = mode === "small" ? PALETTE_SMALL : PALETTE_REGULAR;
            const pick = palette[Math.floor(Math.random() * palette.length)];
            name = pick[0];
            hex = pick[1];
        }

        showColor(name, hex);
    }

    rollBtn.addEventListener("click", rollColor);

    // Share link
    shareColorBtn.addEventListener("click", () => {
        if (!currentColor) return;
        const url = new URL(window.location.href.split("?")[0]);
        url.searchParams.set("color", currentColor.hex.slice(1));
        if (currentColor.name !== "Random") {
            url.searchParams.set("name", currentColor.name);
        }
        navigator.clipboard.writeText(url.toString()).then(() => {
            shareColorBtn.textContent = "✓ Copied!";
            setTimeout(() => { shareColorBtn.textContent = "🔗 Share"; }, 1500);
        });
    });

    // Load color from URL on startup
    const params = new URLSearchParams(window.location.search);
    const urlColor = params.get("color");
    if (urlColor && /^[0-9A-Fa-f]{6}$/.test(urlColor)) {
        const hex = "#" + urlColor.toUpperCase();
        const name = params.get("name") || "Random";
        showColor(name, hex);
    }
})();
