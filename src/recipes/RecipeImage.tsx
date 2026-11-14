import { useEffect, useRef } from 'react'
import mark from '../assets/mark.svg'
import type { Motif } from './recipe'
import { RecipeArt } from './RecipeArt'

function LocalPhoto({ photo }: { photo: Blob }) {
  const image = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const element = image.current
    if (!element) return
    const url = URL.createObjectURL(photo)
    element.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return <img className="recipe-photo" alt="" loading="lazy" ref={image} />
}

export function RecipeImage({ photo, motif }: { photo: Blob | null; motif?: Motif }) {
  return (
    <div className={`recipe-image motif-${motif ?? 'default'}`}>
      {photo ? <LocalPhoto photo={photo} /> : motif ? <RecipeArt motif={motif} /> : <img className="recipe-art" src={mark} alt="" />}
    </div>
  )
}
