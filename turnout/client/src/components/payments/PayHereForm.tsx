import { useEffect, useRef } from 'react'

type Fields = Record<string, string>

export function PayHereForm({ action, fields }: { action: string; fields: Fields }) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [action, fields])

  return (
    <form ref={formRef} method="post" action={action} className="sr-only">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} readOnly />
      ))}
      <noscript>
        <button type="submit">Continue to PayHere</button>
      </noscript>
    </form>
  )
}
