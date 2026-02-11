import { ImageResponse } from 'next/og';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

// フォント読み込み
async function loadGoogleFont(text: string) {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);
    if (resource) {
        const response = await fetch(resource[1]);
        if (response.status == 200) return await response.arrayBuffer();
    }
    return null;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    let topicData = null;
    try {
        if (id) {
            const docRef = doc(db, 'topics', id);
            const snap = await getDoc(docRef);
            if (snap.exists()) topicData = snap.data();
        }
    } catch (e) { console.error('OGP Fetch Error:', e); }

    const title = topicData?.title || '投票に参加しよう！';
    const options = topicData?.options || [];

    // フォント用に表示する可能性のある全文字を結合
    const textToLoad = title + options.map((o: any) => o.text).join('') + '投票受付中🆚あなたはどっち？+他件の選択肢';
    const fontData = await loadGoogleFont(textToLoad);

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
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // 爽やかな青系グラデーション
                    padding: '40px',
                    fontFamily: '"Noto Sans JP"',
                }}
            >
                {/* 背景の装飾 */}
                <div style={{
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 300,
                    height: 300,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%'
                }}
                />

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '40px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                        padding: '30px 50px',
                        width: '94%',
                        height: '90%',
                        border: '2px solid rgba(255,255,255,0.5)',
                    }}
                >
                    {/* 1. タイトル（最上部バッジ） */}
                    <div style={{
                        background: '#3742fa',
                        color: 'white',
                        padding: '15px 40px',
                        borderRadius: '50px',
                        fontSize: 36,
                        fontWeight: 'bold',
                        marginBottom: 20,
                        textAlign: 'center',
                        boxShadow: '0 4px 15px rgba(55, 66, 250, 0.3)',
                        // 長すぎるタイトルは「...」で省略して1行に収める
                        maxWidth: '95%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                    >
                        {title}
                    </div>

                    {/* 2. 中央：サブタイトル */}
                    <div style={{
                        fontSize: 40,
                        fontWeight: '900',
                        color: '#2f3542',
                        marginBottom: 30
                    }}
                    >
                        投票受付中 🆚 あなたはどっち？
                    </div>

                    {/* 3. 選択肢エリア（スリム化して可変に対応） */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexGrow: 1
                    }}
                    >

                        {options.length === 2 ? (
                            /* 【2つの時】 左右に大きく配置 */
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '40px',
                                width: '100%',
                                justifyContent: 'center'
                            }}
                            >
                                {/* 左の選択肢 (青) */}
                                <div style={{
                                    background: '#3742fa',
                                    color: 'white',
                                    padding: '25px 40px',
                                    borderRadius: '25px',
                                    fontSize: 48,
                                    fontWeight: 'bold',
                                    maxWidth: '45%',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {options[0].text}
                                </div>

                                {/* 真ん中のVS */}
                                <div style={{
                                    fontSize: 60,
                                    fontWeight: '900',
                                    color: '#000000',       // 黒色
                                    textShadow: '3px 3px 0px #ffffff', // 白い縁取り
                                    fontStyle: 'italic',    // 斜体
                                }}>
                                    VS
                                </div>

                                {/* 右の選択肢 (赤) */}
                                <div style={{
                                    background: '#FF4757',
                                    color: 'white',
                                    padding: '25px 40px',
                                    borderRadius: '25px',
                                    fontSize: 48,
                                    fontWeight: 'bold',
                                    maxWidth: '45%',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {options[1].text}
                                </div>
                            </div>
                        ) : (
                            /* 【3つ以上の時】 スリムなリスト形式に変更！ */
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                width: '100%',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            >
                                {options.slice(0, 5).map((opt: any, i: number) => (
                                    <div key={i} style={{
                                        background: i === 0 ? '#3742fa' : i === 1 ? '#ff4757' : i === 2 ? '#2ed573' : i === 3 ? '#ffa502' : '#747d8c',
                                        color: 'white',
                                        padding: '10px 0',
                                        borderRadius: '50px',
                                        fontSize: 28, // 文字サイズを小さく
                                        fontWeight: 'bold',
                                        width: '85%',
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                    >
                                        {opt.text}
                                    </div>
                                ))}
                                {options.length > 5 && (
                                    <div style={{
                                        fontSize: 24,
                                        color: '#a4b0be',
                                        fontWeight: 'bold'
                                    }}
                                    >
                                        + 他 {options.length - 5} 件
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* フッター */}
                    <div style={{
                        marginTop: 'auto',
                        paddingTop: 10,
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: '#ced6e0'
                    }}
                    >
                        ODORIO
                    </div>
                </div>
            </div>
        ),
        {
            ...size, fonts: fontData ? [{
                name: 'Noto Sans JP',
                data: fontData,
                style: 'normal',
                weight: 700
            }] : undefined
        }
    );
}