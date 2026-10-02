-- El propio entorno de pruebas: sesiones simuladas y ayudas.
select t.como(1);
do $$
begin
  perform t.afirma(auth.uid() = t.uid(1), 'auth.uid() devuelve la sesión simulada');
  perform t.afirma(current_user = 'authenticated', 'el rol es authenticated');
  perform t.falla('select 1/0', 'division by zero');
  perform t.afirma(t.n('select 1 union all select 2') = 2, 't.n cuenta filas');
end $$;
select t.anonimo();
do $$
begin
  perform t.afirma(current_user = 'anon', 'el rol es anon');
  perform t.afirma(auth.uid() is null, 'anon no tiene sesión');
end $$;
select t.admin();
do $$ begin perform t.afirma(current_user = 'postgres', 'admin vuelve a postgres'); end $$;
