#!/usr/bin/env python3
import os
from collections import defaultdict
from datetime import datetime
from typing import List, Optional, Sequence, Tuple


def unique_target_path(img_dir: str, label_dir: str, filename: str) -> Tuple[str, str]:
    """Return paths for image and label with a collision-safe name."""
    name, ext = os.path.splitext(filename)
    candidate_name = filename
    idx = 1
    while True:
        img_target = os.path.join(img_dir, candidate_name)
        label_target = os.path.join(label_dir, os.path.splitext(candidate_name)[0] + ".txt")
        if not os.path.exists(img_target) and not os.path.exists(label_target):
            return img_target, label_target
        candidate_name = f"{name}_dup{idx}{ext}"
        idx += 1


def get_label_path(image_path: str) -> str:
    """Convert image path to corresponding label path."""
    label_path = image_path.replace("images", "labels")
    label_path = label_path.replace("jpg", "txt")
    label_path = label_path.replace("jpeg", "txt")
    label_path = label_path.replace("png", "txt")
    return label_path


def parse_yolo_labels(image_path: str) -> List[Tuple[int, float, float, float, float]]:
    """
    Parse YOLO format labels from file.
    Returns list of (class_id, x_center, y_center, width, height).
    All coordinates are normalized [0, 1].
    """
    label_path = get_label_path(image_path)

    if not os.path.exists(label_path):
        return []

    labels = []
    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue

            try:
                class_id = int(float(parts[0]))
                x_center = float(parts[1])
                y_center = float(parts[2])
                width = float(parts[3])
                height = float(parts[4])
                labels.append((class_id, x_center, y_center, width, height))
            except (ValueError, IndexError):
                continue

    return labels


def calculate_iou(box1: Tuple[float, float, float, float],
                  box2: Tuple[float, float, float, float]) -> float:
    """
    Calculate IoU (Intersection over Union) between two bounding boxes.
    Boxes are in format (x_center, y_center, width, height) normalized [0, 1].
    """
    x1_min = box1[0] - box1[2] / 2
    y1_min = box1[1] - box1[3] / 2
    x1_max = box1[0] + box1[2] / 2
    y1_max = box1[1] + box1[3] / 2

    x2_min = box2[0] - box2[2] / 2
    y2_min = box2[1] - box2[3] / 2
    x2_max = box2[0] + box2[2] / 2
    y2_max = box2[1] + box2[3] / 2

    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    inter_width = max(0.0, inter_x_max - inter_x_min)
    inter_height = max(0.0, inter_y_max - inter_y_min)
    inter_area = inter_width * inter_height

    box1_area = box1[2] * box1[3]
    box2_area = box2[2] * box2[3]
    union_area = box1_area + box2_area - inter_area

    if union_area == 0:
        return 0.0

    return inter_area / union_area


def labels_are_similar(labels1: List[Tuple[int, float, float, float, float]],
                       labels2: List[Tuple[int, float, float, float, float]],
                       iou_threshold: float,
                       labels_limit: int = 0) -> bool:
    """
    Check if two label sets are similar based on class matching and IoU threshold.
    For multiple boxes of the same class, finds optimal matching using greedy algorithm.
    Returns True if both have same number of boxes, all classes match, and all IoUs exceed threshold.

    Args:
        labels_limit: Number of labels to compare (0 = all labels).
    """
    if labels_limit > 0:
        labels1 = labels1[:labels_limit]
        labels2 = labels2[:labels_limit]

    if len(labels1) != len(labels2):
        return False

    if len(labels1) == 0:
        return False

    classes1 = sorted([label[0] for label in labels1])
    classes2 = sorted([label[0] for label in labels2])
    if classes1 != classes2:
        return False

    groups1 = defaultdict(list)
    groups2 = defaultdict(list)

    for label in labels1:
        class_id = label[0]
        box = label[1:]
        groups1[class_id].append(box)

    for label in labels2:
        class_id = label[0]
        box = label[1:]
        groups2[class_id].append(box)

    for class_id in groups1.keys():
        boxes1 = groups1[class_id]
        boxes2 = groups2[class_id]

        used2 = set()

        for box1 in boxes1:
            best_iou = -1.0
            best_idx = -1

            for idx, box2 in enumerate(boxes2):
                if idx in used2:
                    continue
                iou = calculate_iou(box1, box2)
                if iou > best_iou:
                    best_iou = iou
                    best_idx = idx

            if best_iou < iou_threshold:
                return False

            used2.add(best_idx)

    return True


def find_duplicate_groups(
    image_paths: Sequence[str],
    iou_threshold: float,
    dataset_path: str = "",
    labels_limit: int = 0,
) -> List[List[int]]:
    """
    Find duplicate groups using sequential comparison based on filename order.
    Only uses label comparison (class + bounding box IoU).

    Args:
        labels_limit: Number of labels to compare (0 = all labels).
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    n = len(image_paths)

    if labels_limit > 0:
        print(f"Labels limit: comparing only first {labels_limit} labels for duplicate detection")

    print(f"Finding duplicates in {n} images using IoU threshold {iou_threshold}")

    groups: List[List[int]] = []
    visited = [False] * n

    log_dir = dataset_path or "."
    log_path = os.path.join(log_dir, f"similar_path_{timestamp}.txt")
    with open(log_path, "w", encoding="utf-8") as f:
        i = 0
        while i < n:
            if visited[i]:
                i += 1
                continue

            current_group = [i]
            visited[i] = True
            base_labels = parse_yolo_labels(image_paths[i])

            if not base_labels:
                i += 1
                continue

            j = i + 1
            while j < n:
                if visited[j]:
                    j += 1
                    continue

                compare_labels = parse_yolo_labels(image_paths[j])

                if labels_are_similar(base_labels, compare_labels, iou_threshold, labels_limit):
                    current_group.append(j)
                    visited[j] = True
                    f.write(f"Similar labels (IoU >= {iou_threshold})\n")
                    f.write(f"  base: {image_paths[i]}\n")
                    f.write(f"  match: {image_paths[j]}\n")
                else:
                    break

                j += 1

            if len(current_group) > 1:
                groups.append(current_group)

            i += 1

    return groups


def get_matching_rule(
    dataset_path: str,
    rules: List[dict],
    default_action: str = "move",
) -> dict:
    """
    Find the highest priority rule matching the dataset path.

    Args:
        dataset_path: Path to check against patterns
        rules: List of rule dicts with pattern, action, labels, priority
        default_action: Action when no pattern matches

    Returns:
        dict: {action: str, labels: int} - the effective rule
    """
    matching_rules = []
    path_lower = dataset_path.lower()

    for rule in rules:
        pattern = rule.get("pattern", "")
        if pattern and pattern.lower() in path_lower:
            matching_rules.append(rule)

    if not matching_rules:
        return {"action": default_action, "labels": 0}

    # Sort by priority (lower = higher priority)
    matching_rules.sort(key=lambda r: r.get("priority", 999))
    winner = matching_rules[0]

    return {"action": winner.get("action", default_action), "labels": winner.get("labels", 0)}


def process_duplicates(
    dataset_base: str,
    groups: List[List[int]],
    image_paths: List[str],
    debug: bool,
    action: str = "move",
) -> None:
    """
    Process duplicate groups based on the specified action.

    Args:
        action: "move" to move to duplicate/ folder, "delete" to remove directly.
    """
    if action == "delete":
        # Delete duplicates directly without moving to duplicate folder
        for group_idx, group in enumerate(groups, start=1):
            keep_idx = group[0]
            files_to_delete = group if debug else group[1:]

            for idx in files_to_delete:
                src_img = image_paths[idx]
                stem = os.path.splitext(os.path.basename(src_img))[0]
                src_label = os.path.join(dataset_base, "labels", stem + ".txt")

                # Delete image
                if os.path.exists(src_img):
                    os.remove(src_img)

                # Delete label
                if os.path.exists(src_label):
                    os.remove(src_label)

            if debug:
                print(f"Deleted all {len(group)} duplicates in group {group_idx}")
            else:
                kept = image_paths[keep_idx]
                print(f"Kept original: {kept}; deleted {len(group) - 1} duplicates")
    else:
        # Move duplicates to duplicate/ folder (default behavior)
        dup_root = os.path.join(dataset_base, "duplicate")
        dup_img_root = os.path.join(dup_root, "images")
        dup_label_root = os.path.join(dup_root, "labels")
        os.makedirs(dup_img_root, exist_ok=True)
        os.makedirs(dup_label_root, exist_ok=True)

        for group_idx, group in enumerate(groups, start=1):
            keep_idx = group[0]
            group_folder_img = dup_img_root
            group_folder_label = dup_label_root
            if debug:
                group_name = f"group_{group_idx:04d}"
                group_folder_img = os.path.join(dup_img_root, group_name)
                group_folder_label = os.path.join(dup_label_root, group_name)
                os.makedirs(group_folder_img, exist_ok=True)
                os.makedirs(group_folder_label, exist_ok=True)

            files_to_move = group if debug else group[1:]

            for idx in files_to_move:
                src_img = image_paths[idx]
                stem, ext = os.path.splitext(os.path.basename(src_img))
                target_img_dir = group_folder_img
                target_label_dir = group_folder_label

                if debug:
                    target_img = os.path.join(target_img_dir, os.path.basename(src_img))
                    target_label = os.path.join(target_label_dir, stem + ".txt")
                else:
                    target_img, target_label = unique_target_path(
                        target_img_dir, target_label_dir, os.path.basename(src_img)
                    )

                os.makedirs(os.path.dirname(target_img), exist_ok=True)
                os.makedirs(os.path.dirname(target_label), exist_ok=True)
                os.rename(src_img, target_img)

                src_label = os.path.join(dataset_base, "labels", stem + ".txt")
                if os.path.exists(src_label):
                    os.rename(src_label, target_label)
                else:
                    with open(target_label, "w", encoding="utf-8") as f:
                        f.write("# Label file was missing for this duplicate\n")

            if debug:
                print(f"Moved all {len(group)} duplicates to {group_folder_img}")
            else:
                kept = image_paths[keep_idx]
                print(f"Kept original: {kept}; moved {len(group) - 1} duplicates to {dup_root}")


def handle_duplicates(
    dataset_base: str,
    iou_threshold: float,
    debug: bool,
    duplicate_rules: Optional[List[dict]] = None,
    default_action: str = "move",
) -> None:
    """
    Detect and handle duplicate images based on label similarity (class + IoU).
    No image hash computation - only label file comparison.

    Args:
        duplicate_rules: List of rules for pattern-based duplicate handling.
        default_action: Default action when no rule matches (skip, move, delete).
    """
    if duplicate_rules is None:
        duplicate_rules = []

    # Get matching rule for this dataset path
    rule = get_matching_rule(dataset_base, duplicate_rules, default_action)
    action = rule["action"]
    labels_limit = rule["labels"]

    print(f"Duplicate handling rule: action={action}, labels={labels_limit}")

    # Skip duplicate detection if action is "skip"
    if action == "skip":
        print("Skipping duplicate detection (action=skip)")
        return

    img_dir = os.path.join(dataset_base, "images")
    label_dir = os.path.join(dataset_base, "labels")
    print(f"Image directory: {img_dir}")
    print(f"Label directory: {label_dir}")

    if not os.path.isdir(img_dir) or not os.path.isdir(label_dir):
        print("Images or labels directory not found; skipping duplicate detection")
        return

    image_paths = [
        os.path.join(img_dir, fname)
        for fname in sorted(os.listdir(img_dir))
        if fname.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    if not image_paths:
        print("No images found; skipping duplicate detection")
        return

    print(f"Analyzing {len(image_paths)} images for duplicates using IoU threshold {iou_threshold}")

    groups = find_duplicate_groups(image_paths, iou_threshold, dataset_base, labels_limit)

    if not groups:
        print("No duplicates found.")
        return

    process_duplicates(dataset_base, groups, image_paths, debug, action)
    print(f"Detected {len(groups)} duplicate group(s).")


def find_dataset_roots(root_path: str) -> List[str]:
    dataset_roots: List[str] = []
    for current, dirs, _files in os.walk(root_path):
        has_images = "images" in dirs
        has_labels = "labels" in dirs

        if has_images and has_labels:
            dataset_roots.append(current)

        for skip_dir in ("images", "labels", "duplicate"):
            if skip_dir in dirs:
                dirs.remove(skip_dir)

    return dataset_roots


def prompt_path() -> str:
    while True:
        raw = input("Enter a root path to scan for datasets: ").strip()
        if not raw:
            print("Path is required.")
            continue
        if not os.path.isdir(raw):
            print(f"Not a directory: {raw}")
            continue
        return raw


def prompt_iou_threshold(default_value: float = 0.8) -> float:
    raw = input(f"Enter IoU threshold (0-1) [default {default_value}]: ").strip()
    if not raw:
        return default_value
    try:
        value = float(raw)
    except ValueError:
        print(f"Invalid threshold, using default {default_value}.")
        return default_value
    return max(0.0, min(1.0, value))


def prompt_debug() -> bool:
    raw = input("Enable debug mode (group duplicates into folders)? [y/N]: ").strip().lower()
    return raw in ("y", "yes")


def main() -> None:
    root_path = prompt_path()
    iou_threshold = prompt_iou_threshold(0.8)
    debug = prompt_debug()

    dataset_roots = find_dataset_roots(root_path)
    if not dataset_roots:
        print("No datasets found (missing images/ and labels/ folders).")
        return

    print(f"Found {len(dataset_roots)} dataset(s).")
    for dataset_base in dataset_roots:
        print(f"\n--- Dataset: {dataset_base} ---")
        handle_duplicates(dataset_base, iou_threshold, debug)


def cli_main() -> None:
    """Non-interactive CLI mode for API-driven duplicate detection."""
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Find duplicates in a YOLO dataset")
    parser.add_argument("--dataset-path", required=True, help="Path to dataset root (must contain images/ and labels/)")
    parser.add_argument("--iou-threshold", type=float, default=0.8, help="IoU threshold for duplicate detection")
    parser.add_argument("--output-json", required=True, help="Path to write JSON results")
    parser.add_argument("--action", default="move", choices=["move", "delete", "skip"], help="Action to take on duplicates")
    parser.add_argument("--labels-limit", type=int, default=0, help="Number of labels to compare (0 = all)")
    parser.add_argument("--debug", action="store_true", help="Debug mode (group duplicates into subfolders)")

    args = parser.parse_args()

    dataset_path = args.dataset_path
    iou_threshold = args.iou_threshold
    action = args.action
    labels_limit = args.labels_limit
    debug = args.debug

    if action == "skip":
        result = {
            "duplicateCount": 0,
            "action": "skip",
            "groups": [],
            "skipped": True
        }
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(result, f)
        return

    img_dir = os.path.join(dataset_path, "images")
    label_dir = os.path.join(dataset_path, "labels")

    if not os.path.isdir(img_dir) or not os.path.isdir(label_dir):
        result = {"error": "images/ or labels/ directory not found", "duplicateCount": 0}
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(result, f)
        return

    image_paths = [
        os.path.join(img_dir, fname)
        for fname in sorted(os.listdir(img_dir))
        if fname.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    if not image_paths:
        result = {"duplicateCount": 0, "action": action, "groups": []}
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(result, f)
        return

    groups = find_duplicate_groups(image_paths, iou_threshold, dataset_path, labels_limit)

    duplicate_count = len(groups)
    group_data = []
    for group in groups:
        group_data.append({
            "keep": image_paths[group[0]],
            "duplicates": [image_paths[i] for i in group[1:]]
        })

    if groups:
        process_duplicates(dataset_path, groups, image_paths, debug, action)

    result = {
        "duplicateCount": duplicate_count,
        "action": action,
        "groups": group_data
    }

    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(result, f)


if __name__ == "__main__":
    import sys
    # If any --arg style arguments are passed, use CLI mode
    if len(sys.argv) > 1 and any(a.startswith("--") for a in sys.argv[1:]):
        cli_main()
    else:
        main()
