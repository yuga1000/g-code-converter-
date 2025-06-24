import sys

if len(sys.argv) != 2:
    print('Usage: python convert.py <input_file>')
    sys.exit(1)

output_path = 'converted_output.nc'

with open(sys.argv[1], 'r', newline='') as infile, \
     open(output_path, 'w', newline='') as outfile:
    for line in infile:
        line = line.replace('S1000', 'Z-1')
        line = line.replace('S0', 'Z1')
        outfile.write(line)

print(f'Converted file written to {output_path}')
