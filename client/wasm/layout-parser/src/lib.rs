use wasm_bindgen::prelude::*;

/// Map normalized bounding boxes (x,y,w,h in 0..1) to SigLIP patch indices.
/// Does not receive or process text content — geometry only.
#[wasm_bindgen]
pub fn map_regions_to_patch_indices(
    viewport_width: u32,
    viewport_height: u32,
    grid_rows: u32,
    grid_cols: u32,
    regions_flat: &[f32],
) -> Vec<u32> {
    if viewport_width == 0 || viewport_height == 0 || grid_rows == 0 || grid_cols == 0 {
        return Vec::new();
    }

    let mut indices = Vec::new();
    let mut seen = vec![false; (grid_rows * grid_cols) as usize];

    for chunk in regions_flat.chunks(4) {
        if chunk.len() < 4 {
            continue;
        }
        let x = chunk[0].clamp(0.0, 1.0);
        let y = chunk[1].clamp(0.0, 1.0);
        let w = chunk[2].clamp(0.0, 1.0);
        let h = chunk[3].clamp(0.0, 1.0);

        let px = (x * viewport_width as f32) as u32;
        let py = (y * viewport_height as f32) as u32;
        let pw = ((w * viewport_width as f32) as u32).max(1);
        let ph = ((h * viewport_height as f32) as u32).max(1);

        let patch_w = (viewport_width + grid_cols - 1) / grid_cols;
        let patch_h = (viewport_height + grid_rows - 1) / grid_rows;

        let col_start = (px / patch_w.max(1)).min(grid_cols - 1);
        let col_end = ((px + pw) / patch_w.max(1)).min(grid_cols - 1);
        let row_start = (py / patch_h.max(1)).min(grid_rows - 1);
        let row_end = ((py + ph) / patch_h.max(1)).min(grid_rows - 1);

        for row in row_start..=row_end {
            for col in col_start..=col_end {
                let idx = (row * grid_cols + col) as usize;
                if idx < seen.len() && !seen[idx] {
                    seen[idx] = true;
                    indices.push(idx as u32);
                }
            }
        }
    }

    indices.sort_unstable();
    indices.dedup();
    indices
}

#[wasm_bindgen]
pub fn patch_index_to_normalized_coords(
    patch_index: u32,
    grid_rows: u32,
    grid_cols: u32,
) -> Vec<f32> {
    if grid_cols == 0 || grid_rows == 0 {
        return vec![0.5, 0.5];
    }
    let row = patch_index / grid_cols;
    let col = patch_index % grid_cols;
    let x = (col as f32 + 0.5) / grid_cols as f32;
    let y = (row as f32 + 0.5) / grid_rows as f32;
    vec![x, y]
}
