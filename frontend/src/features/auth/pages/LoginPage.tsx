import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input } from '../../../components'
import { loginErrorMessage, safeRedirectTarget } from '../error-messages'
import { GoogleLoginButton } from '../GoogleLoginButton'
import { loginSchema, type LoginFormValues } from '../schemas'
import { useAuth } from '../useAuth'
import styles from './auth-form.module.css'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)
    try {
      await login(values.email, values.password)
      navigate(safeRedirectTarget(searchParams.get('redirect')), { replace: true })
    } catch (err) {
      setFormError(loginErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Entrar</h1>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting}>
          Entrar
        </Button>
        <div className={styles.divider}>ou</div>
        <GoogleLoginButton onError={setFormError} />
        <p className={styles.switch}>
          Não tem conta? <Link to="/cadastrar">Cadastre-se</Link>
        </p>
      </form>
    </div>
  )
}
