import os, struct, zlib, math

def make_memo_icon(size=512):
    raw = bytearray()
    cx, cy = size / 2.0, size / 2.0
    r_card = size * 0.46
    for y in range(size):
        raw.append(0)
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            nx, ny = abs(dx) / r_card, abs(dy) / r_card
            if (nx**4 + ny**4)**0.25 > 1.0:
                raw.extend((0, 0, 0, 0))
                continue
            bg_r = int(5 + 15 * (y / size))
            bg_g = int(14 + 28 * (x / size))
            bg_b = int(34 + 45 * (y / size))
            ring1 = abs(dist - size * 0.33)
            ring2 = abs(dist - size * 0.22)
            if dist < size * 0.13:
                t = dist / (size * 0.13)
                r, g, b = int(56 * t), int(245 * (1-t) + 189 * t), int(212 * (1-t) + 248 * t)
            elif ring1 < size * 0.022:
                r, g, b = 0, 245, 212
            elif ring2 < size * 0.015:
                r, g, b = 56, 189, 248
            else:
                sheen = max(0.0, 1.0 - math.hypot(x - size*0.3, y - size*0.28) / (size*0.55))
                r = min(255, int(bg_r + sheen * 40))
                g = min(255, int(bg_g + sheen * 80))
                b = min(255, int(bg_b + sheen * 110))
            raw.extend((r, g, b, 255))

    def chunk(tag, data):
        return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", zlib.crc32(tag + data) & 0xffffffff)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")

os.makedirs("www", exist_ok=True)
with open("www/icon.png", "wb") as f:
    f.write(make_memo_icon(512))
