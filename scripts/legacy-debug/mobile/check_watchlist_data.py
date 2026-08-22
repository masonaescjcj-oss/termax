with open(r'C:\t\src\screens\WatchlistScreen.tsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'USOIL' in line or 'INITIAL_WATCHLIST_DATA' in line:
            print(f"{i+1}: {line.strip()}")
