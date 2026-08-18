# -*- coding: utf-8 -*-
"""把 world-atlas TopoJSON (land-50m) 转换为精简经纬度环数据 js/geo.js
输出格式: window.GEO_RINGS = [ [[lng,lat],...], ... ]  含岛屿与湖泊洞环"""
import json

SRC = r'c:\Users\zhang\Desktop\WZY\github files\github files(wzy03.pages.dev)\land-50m.json'
DST = r'c:\Users\zhang\Desktop\WZY\github files\github files(wzy03.pages.dev)\js\geo.js'

d = json.load(open(SRC, encoding='utf-8'))

# 解码变换参数
tr = d['transform']
sx, sy = tr['scale']
ox, oy = tr['translate']

# 解码 delta 编码的 arcs 为经纬度
arcs = []
for arc in d['arcs']:
    pts = []
    x = y = 0.0
    for dx, dy in arc:
        x += dx
        y += dy
        lng = x * sx + ox
        lat = y * sy + oy
        pts.append((lng, lat))
    arcs.append(pts)

def ring_from_arc_ids(ids):
    """把 arc 索引列表拼接成坐标环（处理反向引用 ~i 与首尾去重）"""
    coords = []
    for i in ids:
        if i >= 0:
            seg = arcs[i]
        else:
            seg = list(reversed(arcs[~i]))
        if coords and seg and coords[-1] == seg[0]:
            seg = seg[1:]
        coords.extend(seg)
    return coords

def simplify(coords, tol):
    """径向抽稀：保留与上一个保留点距离 >= tol 度的点，始终保留首尾"""
    if len(coords) <= 4:
        return coords
    out = [coords[0]]
    for p in coords[1:-1]:
        lx, ly = out[-1]
        if (p[0] - lx) ** 2 + (p[1] - ly) ** 2 >= tol * tol:
            out.append(p)
    out.append(coords[-1])
    return out

geom = d['objects']['land']['geometries'][0]  # MultiPolygon
polygons = geom['arcs']  # [ [ring, ring(holes)...], ... ]

polys = []
total_pts = 0
for poly in polygons:
    rings = []
    for ring_ids in poly:
        coords = ring_from_arc_ids(ring_ids)
        coords = simplify(coords, 0.12)
        if len(coords) >= 4:
            rings.append(coords)
            total_pts += len(coords)
    if rings:
        polys.append(rings)

# 输出为紧凑 JS（按多边形分组：第一个环为外环，其余为洞环）
with open(DST, 'w', encoding='utf-8') as f:
    f.write('/* 真实世界陆地轮廓 1:1（Natural Earth 50m，含全部岛屿/湖泊洞环）\n')
    f.write('   格式: window.GEO_POLYS = [ [ [lng,lat]... 外环, 洞环... ], ... ] */\n')
    f.write('window.GEO_POLYS = [')
    poly_parts = []
    for rings in polys:
        ring_parts = []
        for ring in rings:
            inner = ','.join('[%.2f,%.2f]' % (p[0], p[1]) for p in ring)
            ring_parts.append('[' + inner + ']')
        poly_parts.append('[' + ','.join(ring_parts) + ']')
    f.write(','.join(poly_parts))
    f.write('];\n')

print('polys:', len(polys), 'points:', total_pts)
