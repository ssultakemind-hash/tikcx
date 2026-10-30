// Shown for a wrong or deleted link (e.g. a mistyped QR address).
export default function NotFound() {
  return (
    <main className="wrap">
      <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span></div>
      <section className="card">
        <h1>페이지를 찾을 수 없어요</h1>
        <p className="muted">주소가 잘못됐거나, 보관 기간이 끝나 삭제된 앨범일 수 있어요. 받으신 링크나 QR을 다시 확인해 주세요.</p>
      </section>
    </main>
  );
}
