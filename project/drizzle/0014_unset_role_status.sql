UPDATE `members`
SET `acting_state` = ''
WHERE `acting_state` != ''
  AND NOT EXISTS (
    SELECT 1
    FROM `role_statuses`
    WHERE `role_statuses`.`label` = `members`.`acting_state`
  );
