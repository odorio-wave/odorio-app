import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  console.log("★APIルートが呼び出されました");
  console.log("User:", process.env.GMAIL_USER);
  console.log("Pass有無:", !!process.env.GMAIL_PASS);
  try {
    const { name, email, message } = await req.json();

    // 1. Gmailを使ってメールを送る設定
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // 2. メールの内容（あなたに届くメール）
    const mailOptions = {
      from: process.env.GMAIL_USER,      // 送信元（自分のGmail）
      to: process.env.GMAIL_USER,        // 送信先（自分のGmail）
      subject: `【ODORIO】お問い合わせ: ${name}様より`, // メールの件名
      text: `
        以下の内容でお問い合わせがありました。

        -----------------------
        ■お名前:
        ${name}

        ■メールアドレス:
        ${email}

        ■メッセージ:
        ${message}
        -----------------------
      `,
    };

    // 3. 送信実行
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}