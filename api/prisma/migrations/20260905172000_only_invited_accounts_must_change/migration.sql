-- Only a freshly invited account has to change its password.
--
-- `mustChangePassword` was added with a default of true, which is right for
-- accounts created from here on: they are handed a password somebody else
-- generated. It is wrong for accounts that already existed, who chose their
-- own and were suddenly told to choose again.
--
-- The accounts the previous migration created are left flagged. They are
-- inactive and hold a password nobody knows, so they genuinely do have to be
-- reinvited before they can be used.
UPDATE "User"
SET "mustChangePassword" = false
WHERE "active" = true;
