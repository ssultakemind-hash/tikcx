import { notFound } from "next/navigation";
import { coverUrl, formatDate, weddingBySlug } from "@/lib/supabase";
import { phase, shortDate } from "@/lib/dates";
import GuestArea from "./GuestArea";

export const dynamic = "force-dynamic";

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await weddingBySlug(slug);
  if (!w) notFound();
  const p = phase(w.wedding_date);
  const cover = await coverUrl(w.cover_path);

  const hero = (
    <div className={cover ? "hero photo" : "hero"} style={cover ? { backgroundImage: `url("${cover}")` } : undefined}><div>
      <div className="names">{w.couple_names}</div>
      <div className="meta">{[formatDate(w.wedding_date), w.venue].filter(Boolean).join(" · ")}</div>
    </div></div>
  );

  if (p.expired) {
    return (
      <main className="wrap">
        <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>소중한 순간들을 한곳에</small></div>
        <section className="card">
          {hero}
          <h1>함께해 주셔서<br />고마웠어요</h1>
          <p className="muted">보관 기간이 끝나 이 앨범은 종료됐어요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>소중한 순간들을 한곳에</small></div>
      <GuestArea slug={w.slug} uploadOpen={p.uploadOpen}>
        {hero}
        {p.uploadOpen ? (
          <>
            <div>
              <div className="eyebrow">와주셔서 고마워요</div>
              <h1>오늘 찍은 사진,<br />여기에 모아주세요</h1>
            </div>
            <p className="muted">
              앱 설치도, 가입도 필요 없어요. 올려주신 사진은 원본 그대로 두 사람에게 전해져요.
              {p.uploadUntil && <> {shortDate(p.uploadUntil)}까지 올릴 수 있어요.</>}
            </p>
          </>
        ) : (
          <>
            <div>
              <div className="eyebrow">와주셔서 고마워요</div>
              <h1>사진 올리기가<br />마감됐어요</h1>
            </div>
            <p className="muted">보내주신 사진은 두 사람에게 잘 전해졌어요.{w.guest_gallery ? " 아래에서 모두의 사진을 볼 수 있어요." : ""}</p>
          </>
        )}
      </GuestArea>
    </main>
  );
}
