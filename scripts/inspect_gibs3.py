import pathlib
import xml.etree.ElementTree as ET

path = pathlib.Path('gibs_capabilities.xml')
xml = path.read_text(encoding='utf-8')
root = ET.fromstring(xml)
ns = {'wmts': 'http://www.opengis.net/wmts/1.0', 'ows': 'http://www.opengis.net/ows/1.1'}
contents = root.find('wmts:Contents', ns)
if contents is None:
    raise SystemExit('No wmts:Contents found')

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
    print('Identifier:', layer.find('ows:Identifier', ns).text)
    title = layer.find('ows:Title', ns)
    if title is not None:
        print('Title:', title.text)
    for style in layer.findall('wmts:Style', ns):
        ident = style.find('ows:Identifier', ns)
        print('Style:', ident.text if ident is not None else None)
    for dim in layer.findall('wmts:Dimension', ns):
        ident = dim.find('ows:Identifier', ns)
        default = dim.find('wmts:Default', ns)
        print('Dimension:', ident.text if ident is not None else None, 'default', default.text if default is not None else None)
    for res in layer.findall('wmts:ResourceURL', ns):
        print('ResourceURL:', res.attrib)
    for tmsl in layer.findall('wmts:TileMatrixSetLink', ns):
        tms = tmsl.find('wmts:TileMatrixSet', ns)
        if tms is not None:
            print('TileMatrixSetLink:', tms.text)
    print()
