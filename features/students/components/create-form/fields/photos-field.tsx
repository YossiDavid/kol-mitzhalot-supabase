"use client";

import type { FieldControlProps } from "./field-control-types";
import { FieldFrame } from "./field-frame";
import { PhotoGalleryField } from "./photo-gallery-field";

/** "photos": גלריה מסודרת, הראשונה היא הראשית */
export function PhotosField(props: FieldControlProps) {
  return (
    <FieldFrame {...props}>
      {(rhfField) => (
        <PhotoGalleryField
          value={Array.isArray(rhfField.value) ? rhfField.value : []}
          onChange={rhfField.onChange}
        />
      )}
    </FieldFrame>
  );
}
