import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '../../../components'
import { registerErrorMessage } from '../error-messages'
import { registerSchema, type RegisterFormValues } from '../schemas'
import { useAuth } from '../useAuth'
import styles from './auth-form.module.css'

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  })

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null)
    try {
      await registerUser(values.name, values.email, values.password)
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(registerErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Criar conta</h1>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input label="Nome" autoComplete="name" error={errors.name?.message} {...register('name')} />
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
          hint="Mínimo de 10 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting}>
          Criar conta
        </Button>
        <p className={styles.switch}>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
