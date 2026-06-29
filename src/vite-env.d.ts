/// <reference types="vite/client" />

declare namespace google {
  namespace maps {
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: AutocompleteOptions)
        addListener(event: string, handler: () => void): void
        getPlace(): PlaceResult
      }
      interface AutocompleteOptions {
        types?: string[]
        fields?: string[]
        componentRestrictions?: { country: string | string[] }
      }
      interface PlaceResult {
        name?: string
        formatted_address?: string
      }
    }
    namespace event {
      function clearInstanceListeners(instance: object): void
    }
  }
}
