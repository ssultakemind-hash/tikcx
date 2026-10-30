import { notFound } from "next/navigation";
import { formatDate, weddingBySlug } from "@/lib/supabase";
import { isProKey } from "@/lib/proToken";
import ProUploader from "./ProUploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "tikcx. 작가 업로드", robots: { index: false } };

// TAKEMIND photographer's upload page for one wedding (link from the admin page).
export default async function ProPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params;
  const { t } = await searchParams;
  const w = await weddingBySlug(slug);
  if (!w || !isProKey(w.id, t)) notFound();
  return (
    <main className="wrap">
      <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>TAKEMIND 작가 전용</small></div>
      <section className="card">
        <div>
          <div className="eyebrow">{[formatDate(w.wedding_date), w.venue].filter(Boolean).join(" · ")}</div>
          <h1>{w.couple_names}</h1>
        </div>
        <p className="muted">여기서 올린 사진·영상은 <b>TAKEMIND</b> 표시로 대기실 화면, 하객 화면, 신랑·신부 앨범에 바로 들어가요. 기간 제한 없이 올릴 수 있어요.</p>
        <ProUploader slug={w.slug} k={t as string} />
        <p className="fine">이 링크는 작가만 사용해 주세요. 하객에게 보내지 마세요.</p>
      </section>
    </main>
  );
}
