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
          <div className="eyebrow">와주셔서 고마워요</div>
          <h1>오늘 찍은 사진,<br />여기에 모아주세요</h1>
        </div>
        <p className="muted">앱 설치도, 가입도 필요 없어요. 올려주신 사진은 원본 그대로 두 사람에게만 전해져요.</p>
        <Uploader slug={w.slug} />
      </section>
    </main>
  );
}
