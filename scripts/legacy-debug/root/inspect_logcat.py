import os

def parse_logcat(file_path):
    print(f"Reading logcat from: {file_path}")
    if not os.path.exists(file_path):
        print("Error: Logcat file not found!")
        return

    # Keywords to search for
    keywords = [
        'com.isaacars.termax',
        'com.trade.app',
        'com.termex.tradeapp',
        'Fatal',
        'Exception',
        'AndroidRuntime',
        'crash'
    ]

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        print(f"Total lines in logcat: {len(lines)}")
        
        # Search for lines containing keywords
        matched_lines = []
        for i, line in enumerate(lines):
            # Check case-insensitive keyword match
            if any(kw.lower() in line.lower() for kw in keywords):
                matched_lines.append((i+1, line.strip()))
                
        print(f"Total matched lines: {len(matched_lines)}")
        
        # Print the last 60 matched lines (which are typically the most relevant since crashes are at the end)
        print("\nLast 60 matched lines from logcat:")
        for idx, line in matched_lines[-60:]:
            print(f"Line {idx}: {line}")
            
        # Let's search specifically for the FATAL EXCEPTION block
        fatal_blocks = []
        in_fatal = False
        current_block = []
        for i, line in enumerate(lines):
            if 'fatal exception' in line.lower() or 'beginning of crash' in line.lower():
                in_fatal = True
                current_block = [f"Line {i+1}: {line.strip()}"]
            elif in_fatal:
                if len(line.strip()) == 0 or line.startswith('------') or 'fatal' in line.lower() or len(current_block) > 30:
                    # End of block or too long
                    fatal_blocks.append(current_block)
                    current_block = []
                    in_fatal = False
                else:
                    current_block.append(f"Line {i+1}: {line.strip()}")
        if current_block:
            fatal_blocks.append(current_block)
            
        print(f"\nDetected {len(fatal_blocks)} fatal exception/crash blocks:")
        for idx, block in enumerate(fatal_blocks):
            print(f"\n--- Crash Block {idx+1} ---")
            for line in block:
                print(line)

if __name__ == "__main__":
    parse_logcat('logcat_2026-06-26_09-07-20.txt')
