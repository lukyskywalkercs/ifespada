import pathlib
import xml.etree.ElementTree as ET

path = pathlib.Path('gibs_capabilities.xml')
xml = path.read_text(encoding='utf-8')
root = ET.fromstring(xml)
ns = {
    'wmts': 'http://www.opengis.net/wmts/1.0',
    'ows': 'http://www.opengis.net/ows/1.1',
}
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
    for child in layer:
        tag = child.tag.split('}')[-1]
        if tag == 'Identifier':
            print('  Identifier', child.text)
        elif tag == 'Title':
            print('  Title', child.text)
        elif tag == 'Style':
            ident = child.find('ows:Identifier', ns)
            print('  Style', ident.text if ident is not None else None)
        elif tag == 'Dimension':
            ident = child.find('ows:Identifier', ns)
            default = child.find('wmts:Default', ns)
            print('  Dimension', ident.text if ident is not None else None, 'default', default.text if default is not None else None)
        elif tag == 'ResourceURL':
            print('  ResourceURL', child.attrib)
        elif tag == 'TileMatrixSetLink':
            tms = child.find('wmts:TileMatrixSet', ns)
            print('  TileMatrixSetLink', tms.text if tms is not None else None)
    print()

print('=== All layers with ResourceURL templates ===')
for layer in contents.findall('wmts:Layer', ns):
    ident = layer.find('ows:Identifier', ns)
    if ident is None:
        continue
    resource_urls = layer.findall('wmts:ResourceURL', ns)
    if not resource_urls:
        continue
    if any('Time' in (dim.find('ows:Identifier', ns).text or '') for dim in layer.findall('wmts:Dimension', ns)):
        print('Layer', ident.text)
        for rr in resource_urls:
            print('  template', rr.attrib.get('template'), rr.attrib.get('format'))
        print()
