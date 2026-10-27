import { notFound } from "next/navigation";
import { formatDate, weddingBySlug } from "@/lib/supabase";
import Uploader from "./Uploader";

export const dynamic = "force-dynamic";

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await weddingBySlug(slug);
  if (!w) notFound();
  return (
    <main className="wrap">
      <div className="brand">tikcx<small>소중한 순간들을 한곳에</small></div>
      <section className="card">
        <div className="hero"><div>
          <div className="names">{w.couple_names}</div>
          <div className="meta">{[formatDate(w.wedding_date), w.venue].filter(Boolean).join(" · ")}</div>
        </div></div>
        <div>
          <div className="eyebrow">오늘 함께해 주셔서 감사합니다</div>
          <h1>두 분의 소중한 순간을 나눠주세요</h1>
        </div>
        <p className="muted">앱 설치나 회원가입 없이 바로 올릴 수 있어요. 올려주신 사진은 원본 화질 그대로 두 분께만 전달됩니다.</p>
        <Uploader slug={w.slug} />
      </section>
    </main>
  );
}
