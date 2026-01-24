import { ImageResponse } from 'next/og';

// ランタイムの設定（画像生成を高速に行うため）
export const runtime = 'edge';

export const alt = 'ODORIO - 投票と議論のプラットフォーム';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* 背景の装飾（薄い円） */}
                <div
                    style={{
                        position: 'absolute',
                        top: -100,
                        left: -100,
                        width: 400,
                        height: 400,
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.1)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: -50,
                        right: -50,
                        width: 300,
                        height: 300,
                        borderRadius: '50%',
                        background: 'rgba(147, 51, 234, 0.1)',
                    }}
                />

                {/* ロゴ部分 */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 80, marginRight: 20 }}>⚖️</div>
                    <div
                        style={{
                            fontSize: 100,
                            fontWeight: 900,
                            background: 'linear-gradient(to right, #2563eb, #9333ea)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        ODORIO
                    </div>
                </div>

                {/* キャッチコピー枠 */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'white',
                        padding: '20px 60px',
                        borderRadius: 30,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                        border: '2px solid rgba(255,255,255,0.5)',
                    }}
                >
                    <div style={{ fontSize: 32, color: '#64748b', marginBottom: 10 }}>
                        みんなで決める、みんなで話す
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 'bold', color: '#1e293b' }}>
                        投票に参加しよう！
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}