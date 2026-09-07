"""Build a compact spatial reasoning representation from sanitized latents."""

from dataclasses import dataclass

import torch


@dataclass
class SpatialReasoningFeatures:
    """Derived features passed to the text planner (interim bridge for VLM decoder)."""

    patch_count: int
    grid_rows: int
    grid_cols: int
    patch_norms: list[float]
    row_activation_means: list[float]
    col_activation_means: list[float]
    dominant_patch_index: int
    dominant_patch_coords: tuple[float, float]
    sensitive_patch_count: int
    tensor_mean: float
    tensor_std: float

    def to_prompt_context(self) -> str:
        x, y = self.dominant_patch_coords
        return (
            f"Spatial layout summary (sanitized latent, no raw pixels):\n"
            f"- Grid: {self.grid_rows}x{self.grid_cols} ({self.patch_count} patches)\n"
            f"- Dominant activation patch: index={self.dominant_patch_index}, "
            f"normalized_coords=({x:.3f}, {y:.3f})\n"
            f"- Sensitive patches sanitized: {self.sensitive_patch_count}\n"
            f"- Row activation profile: {[round(v, 3) for v in self.row_activation_means[:6]]}...\n"
            f"- Col activation profile: {[round(v, 3) for v in self.col_activation_means[:6]]}...\n"
        )


def extract_spatial_features(
    tensor: torch.Tensor,
    grid_rows: int,
    grid_cols: int,
    sensitive_patch_indices: list[int],
) -> SpatialReasoningFeatures:
    if tensor.dim() != 2:
        raise ValueError("Expected 2D patch embedding tensor")

    patch_count, _ = tensor.shape
    norms = tensor.norm(dim=1)
    dominant_index = int(norms.argmax().item())

    row_idx = dominant_index // grid_cols
    col_idx = dominant_index % grid_cols
    norm_x = (col_idx + 0.5) / grid_cols
    norm_y = (row_idx + 0.5) / grid_rows

    grid = norms.reshape(grid_rows, grid_cols)
    row_means = grid.mean(dim=1).tolist()
    col_means = grid.mean(dim=0).tolist()

    return SpatialReasoningFeatures(
        patch_count=patch_count,
        grid_rows=grid_rows,
        grid_cols=grid_cols,
        patch_norms=[round(float(v), 4) for v in norms[:24].tolist()],
        row_activation_means=[round(v, 4) for v in row_means],
        col_activation_means=[round(v, 4) for v in col_means],
        dominant_patch_index=dominant_index,
        dominant_patch_coords=(norm_x, norm_y),
        sensitive_patch_count=len(sensitive_patch_indices),
        tensor_mean=float(tensor.mean().item()),
        tensor_std=float(tensor.std().item()),
    )
