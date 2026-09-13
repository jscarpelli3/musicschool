-- Avatars are normalized to a small WebP before storage, but keep the bucket
-- limit aligned with the app's accepted source-image size.
update storage.buckets
set file_size_limit = 5242880
where id = 'avatars';
