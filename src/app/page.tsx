"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"

export default function Home() {
  const router = useRouter()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  useEffect(() => {
    router.replace(isAuthenticated ? "/dashboard" : "/login")
  }, [isAuthenticated, router])

  return null
}
