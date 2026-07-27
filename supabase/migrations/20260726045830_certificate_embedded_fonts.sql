-- Certificate fonts are private assets. They are served through short-lived
-- signed URLs to the editor and embedded by the server when a PDF is issued.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'font/otf', 'font/ttf', 'application/font-sfnt']
where id = 'certificate-assets';
