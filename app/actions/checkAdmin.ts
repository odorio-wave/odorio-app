'use server'

// このファイルはサーバー側でのみ実行されます
export async function checkIsAdmin(email: string | null | undefined) {
  if (!email) return false;

  // 環境変数（サーバーにある正解のメアド）と比較
  // 環境変数は process.env.変数名 で取得できます
  const adminEmail = process.env.ADMIN_EMAIL_ADDRESS;

  return email === adminEmail;
}