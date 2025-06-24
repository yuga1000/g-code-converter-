import sys

if len(sys.argv) != 2:
    print('Usage: python convert.py <input_file>')
    sys.exit(1)

with open(sys.argv[1], 'r', newline='') as f:
    for line in f:
        line = line.replace('S1000', 'Z-1 F1000')
        line = line.replace('S0', 'Z1 F1000')
        sys.stdout.write(line)
