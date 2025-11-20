import React from 'react';
import { FormData, Language } from '../../types';
import { content } from '../../constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormStep1Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  language: Language;
}

const FormStep1: React.FC<FormStep1Props> = ({ data, errors, handleChange, language }) => {
  const t = content[language].form.step1;

  // Helper function to handle select changes
  const handleSelectChange = (name: keyof FormData) => (value: string) => {
    const syntheticEvent = {
      target: {
        name,
        value,
      },
    } as React.ChangeEvent<HTMLSelectElement>;
    handleChange(syntheticEvent);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2">
        {t.playerInfoHeader}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="playerFullName">
            {t.playerFullName.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="playerFullName"
            name="playerFullName"
            type="text"
            value={data.playerFullName}
            placeholder={t.playerFullName.placeholder}
            onChange={handleChange}
            className={errors.playerFullName ? 'border-destructive' : ''}
          />
          {errors.playerFullName && (
            <p className="text-sm text-destructive">{errors.playerFullName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">
            {t.dateOfBirth.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={data.dateOfBirth}
            onChange={handleChange}
            className={errors.dateOfBirth ? 'border-destructive' : ''}
          />
          {errors.dateOfBirth && (
            <p className="text-sm text-destructive">{errors.dateOfBirth}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="playerCategory">
          {t.playerCategory.label} <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.playerCategory}
          onValueChange={handleSelectChange('playerCategory')}
        >
          <SelectTrigger className={errors.playerCategory ? 'border-destructive' : ''}>
            <SelectValue placeholder={t.playerCategory.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M9">M9 (Under 9)</SelectItem>
            <SelectItem value="M11">M11 (Under 11)</SelectItem>
            <SelectItem value="M13">M13 (Under 13)</SelectItem>
            <SelectItem value="M15">M15 (Under 15)</SelectItem>
            <SelectItem value="M18">M18 (Under 18)</SelectItem>
            <SelectItem value="Junior">Junior</SelectItem>
          </SelectContent>
        </Select>
        {errors.playerCategory && (
          <p className="text-sm text-destructive">{errors.playerCategory}</p>
        )}
      </div>

      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 pt-4">
        {t.parentInfoHeader}
      </h3>

      <div className="space-y-2">
        <Label htmlFor="parentFullName">
          {t.parentFullName.label} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="parentFullName"
          name="parentFullName"
          type="text"
          value={data.parentFullName}
          placeholder={t.parentFullName.placeholder}
          onChange={handleChange}
          className={errors.parentFullName ? 'border-destructive' : ''}
        />
        {errors.parentFullName && (
          <p className="text-sm text-destructive">{errors.parentFullName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="parentEmail">
            {t.parentEmail.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="parentEmail"
            name="parentEmail"
            type="email"
            value={data.parentEmail}
            placeholder={t.parentEmail.placeholder}
            onChange={handleChange}
            className={errors.parentEmail ? 'border-destructive' : ''}
          />
          {errors.parentEmail && (
            <p className="text-sm text-destructive">{errors.parentEmail}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parentPhone">
            {t.parentPhone.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            value={data.parentPhone}
            placeholder={t.parentPhone.placeholder}
            onChange={handleChange}
            className={errors.parentPhone ? 'border-destructive' : ''}
          />
          {errors.parentPhone && (
            <p className="text-sm text-destructive">{errors.parentPhone}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="parentCity">
            {t.parentCity.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="parentCity"
            name="parentCity"
            type="text"
            value={data.parentCity}
            placeholder={t.parentCity.placeholder}
            onChange={handleChange}
            className={errors.parentCity ? 'border-destructive' : ''}
          />
          {errors.parentCity && (
            <p className="text-sm text-destructive">{errors.parentCity}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parentPostalCode">
            {t.parentPostalCode.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="parentPostalCode"
            name="parentPostalCode"
            type="text"
            value={data.parentPostalCode}
            placeholder={t.parentPostalCode.placeholder}
            onChange={handleChange}
            className={errors.parentPostalCode ? 'border-destructive' : ''}
          />
          {errors.parentPostalCode && (
            <p className="text-sm text-destructive">{errors.parentPostalCode}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="communicationLanguage">
          {t.communicationLanguage.label} <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.communicationLanguage}
          onValueChange={handleSelectChange('communicationLanguage')}
        >
          <SelectTrigger className={errors.communicationLanguage ? 'border-destructive' : ''}>
            <SelectValue placeholder={t.communicationLanguage.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="French">Français</SelectItem>
            <SelectItem value="English">English</SelectItem>
          </SelectContent>
        </Select>
        {errors.communicationLanguage && (
          <p className="text-sm text-destructive">{errors.communicationLanguage}</p>
        )}
      </div>

      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 pt-4">
        {t.emergencyContactHeader}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">
            {t.emergencyContactName.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            type="text"
            value={data.emergencyContactName}
            placeholder={t.emergencyContactName.placeholder}
            onChange={handleChange}
            className={errors.emergencyContactName ? 'border-destructive' : ''}
          />
          {errors.emergencyContactName && (
            <p className="text-sm text-destructive">{errors.emergencyContactName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone">
            {t.emergencyContactPhone.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            value={data.emergencyContactPhone}
            placeholder={t.emergencyContactPhone.placeholder}
            onChange={handleChange}
            className={errors.emergencyContactPhone ? 'border-destructive' : ''}
          />
          {errors.emergencyContactPhone && (
            <p className="text-sm text-destructive">{errors.emergencyContactPhone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyRelationship">
            {t.emergencyRelationship.label} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="emergencyRelationship"
            name="emergencyRelationship"
            type="text"
            value={data.emergencyRelationship}
            placeholder={t.emergencyRelationship.placeholder}
            onChange={handleChange}
            className={errors.emergencyRelationship ? 'border-destructive' : ''}
          />
          {errors.emergencyRelationship && (
            <p className="text-sm text-destructive">{errors.emergencyRelationship}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormStep1;
