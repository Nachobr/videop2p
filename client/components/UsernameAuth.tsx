"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"

export function UsernameAuth({ onConnect }: { onConnect: (username: string) => void }) {
  const [inputUsername, setInputUsername] = useState("")

  const handleUsernameSubmit = useCallback(() => {
    console.log("UsernameAuth: Username submitted:", inputUsername)
    onConnect(inputUsername)
  }, [inputUsername, onConnect])

  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold mb-4">Enter a username to start</h2>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter username"
          value={inputUsername}
          onChange={(e) => setInputUsername(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <Button onClick={handleUsernameSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
          Confirm
        </Button>
      </div>
    </div>
  )
}