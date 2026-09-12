
import { Chat } from '../components/Chat';

export function AIPage() {
    return (
        <div className="page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, maxWidth: 960, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
                <Chat wide />
            </div>
        </div>
    );
}
