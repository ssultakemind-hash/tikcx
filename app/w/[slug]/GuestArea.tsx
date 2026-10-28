"use client";
import { useState } from "react";
import Uploader from "./Uploader";
import MyPhotos from "./MyPhotos";
import Wall from "./Wall";

export default function GuestArea({ slug, uploadOpen, children }: { slug: string; uploadOpen: boolean; children: React.ReactNode }) {
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <section className="card">
        {children}
        {uploadOpen && <Uploader slug={slug} onDone={() => setRefresh((n) => n + 1)} />}
      </section>
      <MyPhotos slug={slug} refresh={refresh} />
      <Wall slug={slug} refresh={refresh} />
    </>
  );
}
