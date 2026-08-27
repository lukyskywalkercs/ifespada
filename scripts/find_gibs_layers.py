import pathlib
from collections import defaultdict
import re
path = pathlib.Path('gibs_capabilities.xml')
text = path.read_text('utf-8')
lines = text.splitlines()
keywords = ['TrueColor', 'CorrectedReflectance', 'Terra', 'VIIRS', 'MODIS', 'Bands721', 'Cirrus', 'Infrared']
for keyword in keywords:
    print('---', keyword, '---')
    count = 0
    for i, line in enumerate(lines):
        if keyword in line:
            count += 1
            print(i+1, line.strip())
            if count >= 20:
                break
    if count == 0:
        print('none')

print('\n--- Available MODIS_Terra* identifiers ---')
for i, line in enumerate(lines):
    if '<ows:Identifier>MODIS_Terra' in line:
        print(i+1, line.strip())

print('\n--- Available VIIRS_SNPP* identifiers ---')
for i, line in enumerate(lines):
    if '<ows:Identifier>VIIRS_SNPP' in line:
        print(i+1, line.strip())
