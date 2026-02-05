# LoadyourPractice

Easy app to convert your paper practice exams in to a dynamic digital form.

## Gebruik

1. Open `index.html` in je browser (lokaal of via GitHub Pages).
2. Klik **Gebruik voorbeeldbestand** om meteen te testen.
3. Of kies je eigen `.psm1`/`.txt` bestand met het formaat:
   - `QUESTION <nummer>`
   - antwoordopties zoals `A.` `B.` `C.` etc.
   - `Correct Answer: <letters>` (bijv. `AB`)
4. Beantwoord vragen en klik **Controleer antwoord**.
5. Klik **Toon score** om je totaal goed/fout te zien.
6. Wissel van thema met de knoppen bovenaan.

## Bestandsformaat

Het bestand mag plain text zijn en volgt dezelfde stijl als `sample.psm1`:

- `QUESTION <nummer>` start een nieuwe vraag.
- Tekstregels tussen vraag en opties worden samengevoegd als de vraagtekst.
- Opties beginnen met `A.` `B.` etc.
- `Correct Answer: <letters>` bepaalt de juiste antwoorden.

## Voorbeeld

Zie `sample.psm1` voor een compleet voorbeeldbestand.