"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/api"

export default function Home() {
  const router = useRouter()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    router.replace(isAuthenticated ? "/dashboard" : "/login")
  }, [isAuthenticated, router])

  return null
}
