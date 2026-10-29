"use client";
import { useEffect, useState } from "react";
import Uploader from "./Uploader";
import MyPhotos from "./MyPhotos";
import Wall from "./Wall";
import LeadForm from "./LeadForm";
import { countVisit } from "@/lib/upload";

export default function GuestArea({ slug, uploadOpen, children }: { slug: string; uploadOpen: boolean; children: React.ReactNode }) {
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { countVisit(slug); }, [slug]);
  return (
    <>
      <section className="card">
        {children}
        {uploadOpen && <Uploader slug={slug} onDone={() => setRefresh((n) => n + 1)} />}
        {uploadOpen && (
          <p className="fine">
            사진을 올리면 두 사람에게 전해지고, 두 사람이 허락하면 다른 하객도 미리보기로 볼 수 있어요.
            예식 30일 뒤 모두 삭제돼요. <a href="/privacy">개인정보 안내</a>
          </p>
        )}
      </section>
      <MyPhotos slug={slug} refresh={refresh} />
      <Wall slug={slug} refresh={refresh} />
      <LeadForm slug={slug} />
    </>
  );
}
