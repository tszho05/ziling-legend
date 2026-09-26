"""Deterministic export only: use generated frames, retain scale, align to game feet."""
from pathlib import Path
import argparse
import importlib.util
import json
import numpy as np
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--processor', type=Path, required=True)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('sprite_processor', args.processor)
    processor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(processor)
    root = Path(__file__).resolve().parent
    processed = root / 'processed'
    delivery = root / 'delivery'
    delivery.mkdir(exist_ok=True)
    meta = json.loads((processed / 'pipeline-meta.json').read_text(encoding='utf-8'))
    assert meta['rows'] == meta['cols'] == 4
    assert meta['cell_size'] == 256
    assert not meta['empty_frames'] and not meta['output_edge_touch_frames']
    frames, records = [], []
    feet_y = 246  # 10 transparent pixels below the feet: 3.90625% of 256.
    for label in meta['frame_labels']:
        source = Image.open(processed / (label + '.png')).convert('RGBA')
        # Drop near-invisible generator/resampling alpha speckles before anchoring.
        pixels = np.array(source)
        pixels[pixels[:, :, 3] < 8] = 0
        source = Image.fromarray(pixels)
        bbox = source.getbbox()
        assert source.size == (256, 256) and bbox is not None
        dy = feet_y - bbox[3]
        assert bbox[1] + dy > 0
        final = Image.new('RGBA', (256, 256))
        final.paste(source, (0, dy))
        output_bbox = final.getbbox()
        assert output_bbox[3] == feet_y
        assert output_bbox[0] > 0 and output_bbox[2] < 256
        assert final.getchannel('A').getextrema() == (0, 255)
        pixels = np.asarray(final, dtype=np.int16)
        visible = pixels[:, :, 3] > 0
        magenta = visible & (pixels[:, :, 0] > 150) & (pixels[:, :, 2] > 110) & (pixels[:, :, 1] < 100) & ((pixels[:, :, 0] - pixels[:, :, 1]) > 70) & ((pixels[:, :, 2] - pixels[:, :, 1]) > 60)
        assert not np.any(magenta), f'Magenta fringe in {label}'
        final.save(delivery / (label + '.png'))
        frames.append(final)
        records.append({'label': label, 'bbox': list(output_bbox), 'translation_y': dy, 'visible_pixels': int(visible.sum()), 'magenta_pixels': int(magenta.sum())})

    sheet = processor.compose_sheet(frames, 4, 4, 256)
    sheet.save(delivery / 'sheet-transparent.png')
    # Directional GIF previews; production animation uses the PNG at exactly 8 fps.
    for row, direction in enumerate(('down', 'left', 'right', 'up')):
        subset = frames[row * 4:(row + 1) * 4]
        processor.compose_sheet(subset, 1, 4, 256).save(delivery / f'{direction}-strip.png')
        processor.save_transparent_gif(subset, delivery / f'{direction}.gif', 125)

    preview_frames = []
    for phase in range(4):
        canvas = Image.new('RGBA', (1024, 256), '#e8e1d1')
        for direction in range(4):
            canvas.alpha_composite(frames[direction * 4 + phase], (256 * direction, 0))
        preview_frames.append(canvas)
    preview_frames[0].save(delivery / 'walk-preview.webp', save_all=True, append_images=preview_frames[1:], duration=125, loop=0, lossless=True)
    preview_frames[0].save(delivery / 'walk-preview.gif', save_all=True, append_images=preview_frames[1:], duration=[120, 130, 120, 130], loop=0, disposal=2)
    contact = Image.new('RGBA', sheet.size, '#e8e1d1')
    contact.alpha_composite(sheet)
    contact.convert('RGB').save(delivery / 'contact-sheet.png')
    qc = {
        'sheet_size': [1024, 1024], 'cell_size': [256, 256],
        'rows': ['down', 'left', 'right', 'up'], 'frames_per_direction': 4,
        'fps': 8, 'feet_y_exclusive': feet_y, 'bottom_padding': 10,
        'feet_fraction': 10 / 256, 'shared_scale': True,
        'alpha_cleanup_threshold': 8,
        'uniform_source_to_output_scale': meta['frames'][0]['source_to_output_scale'],
        'processor_qc': meta['qc_summary'], 'empty_frames': 0,
        'output_edge_touch_frames': 0, 'magenta_fringe_pixels': 0,
        'frames': records,
    }
    (delivery / 'qc.json').write_text(json.dumps(qc, indent=2), encoding='utf-8')
    destination = root.parents[2] / 'assets' / 'sprites' / 'hero_swordsman_walk.png'
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)
    print(json.dumps({'destination': str(destination), 'qc': qc}, indent=2))


if __name__ == '__main__':
    main()
