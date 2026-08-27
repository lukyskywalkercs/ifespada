import pathlib
import xml.etree.ElementTree as ET

path = pathlib.Path('gibs_capabilities.xml')
xml = path.read_text(encoding='utf-8')
root = ET.fromstring(xml)
ns = {'wmts': 'http://www.opengis.net/wmts/1.0', 'ows': 'http://www.opengis.net/ows/1.1'}
contents = root.find('wmts:Contents', ns)
print('Contents found:', contents is not None)
if contents is None:
    raise SystemExit(1)

candidates = [
    'MODIS_Terra_CorrectedReflectance_Bands721',
    'MODIS_Terra_CorrectedReflectance_TrueColor',
    'VIIRS_SNPP_CorrectedReflectance_TrueColor_Granule',
    'VIIRS_SNPP_CorrectedReflectance_TrueColor',
]

for candidate in candidates:
    layer = contents.find(f"wmts:Layer[ows:Identifier='{candidate}']", ns)
    print('===', candidate, 'found=', layer is not None)
    if layer is None:
        continue
    for child in layer:
        tag = child.tag.split('}')[-1]
        if tag in ('Title', 'Identifier'):
            print(' ', tag, child.text)
        elif tag == 'Style':
            ident = child.find('ows:Identifier', ns)
            print(' ', 'Style', ident.text if ident is not None else None)
        elif tag == 'Dimension':
            ident = child.find('ows:Identifier', ns)
            default = child.find('wmts:Default', ns)
            print(' ', 'Dimension', ident.text if ident is not None else None, 'Default', default.text if default is not None else None)
        elif tag == 'ResourceURL':
            print(' ', 'ResourceURL', child.attrib)
        elif tag == 'TileMatrixSetLink':
            tms = child.find('wmts:TileMatrixSet', ns)
            print(' ', 'TileMatrixSetLink', tms.text if tms is not None else None)
        elif tag == 'BoundingBox':
            print(' ', 'BoundingBox')
    print()

print('Searching all layers for REST ResourceURL templates with default Time dimension...')
for layer in contents.findall('wmts:Layer', ns):
    ident = layer.find('ows:Identifier', ns)
    if ident is None:
        continue
    has_time = layer.find("wmts:Dimension[ows:Identifier='Time']", ns) is not None
    if not has_time:
        continue
    resource_urls = layer.findall('wmts:ResourceURL', ns)
    if resource_urls:
        print('Layer', ident.text)
        for rr in resource_urls:
            print('  URL', rr.attrib)
        print()
